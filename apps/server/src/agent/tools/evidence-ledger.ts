/**
 * [INPUT]: URLs and content returned by trusted collection Tools
 * [OUTPUT]: Per-run immutable evidence metadata and URL membership checks
 * [POS]: In-memory evidence authority used by submission validation and checkpoints
 */

import { createHash } from 'node:crypto';
import * as ipaddr from 'ipaddr.js';
import { Logger } from '@nestjs/common';
import type { UrlValidator } from '../../common/validators/url.validator';

export interface EvidenceLedgerEntry {
  normalizedUrl: string;
  title: string | null;
  retrievedAt: string;
  toolName: string;
  contentHash: string;
}

export interface RecordEvidenceInput {
  url: string;
  title?: string;
  content: string;
  toolName: string;
  retrievedAt?: Date;
}

const MAX_LEDGER_ENTRIES = 1_000;
const evidenceLogger = new Logger('EvidenceLedger');

export function normalizeEvidenceUrl(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Evidence URL must use HTTP or HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('Evidence URL must not include credentials');
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    hostname === 'localhost' ||
    hostname === 'metadata.google.internal' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('Evidence URL must use a public host');
  }
  if (ipaddr.isValid(hostname)) {
    const address = ipaddr.parse(hostname);
    const ipv6 = address.kind() === 'ipv6' ? (address as ipaddr.IPv6) : null;
    const normalized =
      ipv6?.isIPv4MappedAddress() === true ? ipv6.toIPv4Address() : address;
    if (normalized.range() !== 'unicast') {
      throw new Error('Evidence URL must use a public host');
    }
  }
  url.hash = '';
  url.searchParams.sort();
  return url.toString();
}

export async function recordPublicEvidence(
  ledger: EvidenceLedger,
  urlValidator: Pick<UrlValidator, 'isAllowed'>,
  input: RecordEvidenceInput,
): Promise<EvidenceLedgerEntry | null> {
  if (!(await urlValidator.isAllowed(input.url))) {
    evidenceLogger.warn(
      JSON.stringify({
        event: 'evidence_rejected',
        runId: ledger.runId,
        toolName: input.toolName,
        reason: 'URL_NOT_PUBLIC',
      }),
    );
    return null;
  }
  try {
    return ledger.record(input);
  } catch {
    evidenceLogger.warn(
      JSON.stringify({
        event: 'evidence_rejected',
        runId: ledger.runId,
        toolName: input.toolName,
        reason: 'INVALID_EVIDENCE',
      }),
    );
    return null;
  }
}

function contentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export class EvidenceLedger {
  private readonly entries: EvidenceLedgerEntry[] = [];
  private readonly urls = new Set<string>();

  constructor(readonly runId: string) {
    if (!runId.trim()) throw new Error('Evidence Ledger requires a Run ID');
  }

  record(input: RecordEvidenceInput): EvidenceLedgerEntry {
    if (this.entries.length >= MAX_LEDGER_ENTRIES) {
      throw new Error('Evidence Ledger entry limit reached');
    }
    const normalizedUrl = normalizeEvidenceUrl(input.url);
    const entry: EvidenceLedgerEntry = Object.freeze({
      normalizedUrl,
      title: input.title?.trim().slice(0, 500) || null,
      retrievedAt: (input.retrievedAt ?? new Date()).toISOString(),
      toolName: input.toolName,
      contentHash: contentHash(input.content),
    });
    this.entries.push(entry);
    this.urls.add(normalizedUrl);
    return entry;
  }

  hasUrl(url: string): boolean {
    try {
      return this.urls.has(normalizeEvidenceUrl(url));
    } catch {
      return false;
    }
  }

  snapshot(): readonly EvidenceLedgerEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }

  restore(entries: readonly EvidenceLedgerEntry[]): void {
    if (this.entries.length > 0) {
      throw new Error('Evidence Ledger can only restore into an empty ledger');
    }
    for (const entry of entries) {
      if (this.entries.length >= MAX_LEDGER_ENTRIES) {
        throw new Error('Evidence Ledger entry limit reached');
      }
      const normalizedUrl = normalizeEvidenceUrl(entry.normalizedUrl);
      const retrievedAt = new Date(entry.retrievedAt);
      if (
        Number.isNaN(retrievedAt.getTime()) ||
        !/^[a-f0-9]{64}$/.test(entry.contentHash) ||
        !entry.toolName.trim()
      ) {
        throw new Error('Invalid Evidence Ledger checkpoint');
      }
      const restored: EvidenceLedgerEntry = Object.freeze({
        normalizedUrl,
        title: entry.title?.trim().slice(0, 500) || null,
        retrievedAt: retrievedAt.toISOString(),
        toolName: entry.toolName,
        contentHash: entry.contentHash,
      });
      this.entries.push(restored);
      this.urls.add(normalizedUrl);
    }
  }
}

export class EvidenceLedgerStore {
  private readonly ledgers = new Map<string, EvidenceLedger>();

  create(runId: string): EvidenceLedger {
    if (this.ledgers.has(runId)) {
      throw new Error('Evidence Ledger already exists for Run');
    }
    const ledger = new EvidenceLedger(runId);
    this.ledgers.set(runId, ledger);
    return ledger;
  }

  get(runId: string): EvidenceLedger {
    const ledger = this.ledgers.get(runId);
    if (!ledger) throw new Error('Evidence Ledger not initialized for Run');
    return ledger;
  }

  initialize(
    runId: string,
    entries: readonly EvidenceLedgerEntry[] = [],
  ): EvidenceLedger {
    this.delete(runId);
    const ledger = this.create(runId);
    if (entries.length > 0) ledger.restore(entries);
    return ledger;
  }

  delete(runId: string): void {
    this.ledgers.delete(runId);
  }
}
