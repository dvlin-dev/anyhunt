/**
 * [INPUT]: URL string to validate
 * [OUTPUT]: Boolean - whether URL is allowed for external network access
 * [POS]: SSRF protection - blocks private IPs, localhost, metadata endpoints, IPv6 literals
 *
 * [PROTOCOL]: 仅在本文件 Header 事实或所属目录职责、结构、关键契约变化时，才更新 Header 或目录 CLAUDE.md。
 */
import { Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import * as ipaddr from 'ipaddr.js';

@Injectable()
export class UrlValidator {
  private readonly ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
  private readonly BLOCKED_DOMAINS = new Set([
    'localhost',
    'metadata.google.internal',
  ]);
  private readonly BLOCKED_DOMAIN_SUFFIXES = [
    '.localhost',
    '.local',
    '.internal',
  ];
  private readonly DNS_TIMEOUT_MS = 3000;

  /**
   * 验证 URL 是否允许访问
   */
  async isAllowed(url: string): Promise<boolean> {
    const urlObj = this.parseUrl(url);
    if (!urlObj) return false;

    if (!this.ALLOWED_PROTOCOLS.has(urlObj.protocol)) {
      return false;
    }

    if (urlObj.username || urlObj.password) {
      return false;
    }

    const hostname = this.normalizeHostname(urlObj.hostname);
    if (!hostname) {
      return false;
    }

    if (this.isBlockedDomain(hostname)) {
      return false;
    }

    const addresses = await this.resolveHost(hostname);
    if (addresses.length === 0) return false;

    // Never cache a positive DNS decision: each outbound request and redirect
    // must observe the current address set to fail closed on DNS rebinding.
    return addresses.every((address) => this.isPublicIp(address));
  }

  private parseUrl(url: string): URL | null {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  }

  private normalizeHostname(hostname: string): string {
    const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
    if (!normalized) return '';
    const unbracketed =
      normalized.startsWith('[') && normalized.endsWith(']')
        ? normalized.slice(1, -1)
        : normalized;
    if (!unbracketed) return '';
    const zoneIndex = unbracketed.indexOf('%');
    return zoneIndex === -1 ? unbracketed : unbracketed.slice(0, zoneIndex);
  }

  private isBlockedDomain(hostname: string): boolean {
    if (this.BLOCKED_DOMAINS.has(hostname)) {
      return true;
    }
    return this.BLOCKED_DOMAIN_SUFFIXES.some((suffix) =>
      hostname.endsWith(suffix),
    );
  }

  private async resolveHost(hostname: string): Promise<string[]> {
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      const lookupPromise = lookup(hostname, { all: true, verbatim: true });
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('DNS lookup timeout')),
          this.DNS_TIMEOUT_MS,
        );
      });

      const results = await Promise.race([lookupPromise, timeoutPromise]);
      return results.map((entry) => entry.address);
    } catch {
      return [];
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private isPublicIp(address: string): boolean {
    if (!ipaddr.isValid(address)) {
      return false;
    }

    const parsed = ipaddr.parse(address);

    if (this.isIpv6Address(parsed) && parsed.isIPv4MappedAddress()) {
      const ipv4 = parsed.toIPv4Address().toString();
      return this.isPublicIp(ipv4);
    }

    return parsed.range() === 'unicast';
  }

  private isIpv6Address(
    address: ipaddr.IPv4 | ipaddr.IPv6,
  ): address is ipaddr.IPv6 {
    return address.kind() === 'ipv6';
  }
}
