/**
 * [INPUT]: Agent RSS/Atom URL
 * [OUTPUT]: Bounded normalized feed entries
 * [POS]: RSS Tool using the shared SSRF-safe HTTP fetch boundary
 */

import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import { fetchWithSsrGuard } from '../../common/utils/ssrf-fetch';
import type { UrlValidator } from '../../common/validators/url.validator';
import type { RegisteredAgentToolDefinition } from './agent-tool-registry.service';
import {
  recordPublicEvidence,
  type EvidenceLedgerStore,
} from './evidence-ledger';

const MAX_FEED_BYTES = 1024 * 1024;

const ReadRssInputSchema = z.object({
  url: z.url({ protocol: /^https?$/ }),
  limit: z.number().int().min(1).max(50).default(30),
});

type ReadRssInput = z.infer<typeof ReadRssInputSchema>;

interface FeedValue {
  '#text'?: string;
  '@_href'?: string;
}

interface FeedEntry {
  title?: string | FeedValue;
  link?: string | FeedValue | FeedValue[];
  description?: string | FeedValue;
  summary?: string | FeedValue;
  content?: string | FeedValue;
  pubDate?: string;
  published?: string;
  updated?: string;
}

interface ParsedFeed {
  rss?: { channel?: { title?: string; item?: FeedEntry | FeedEntry[] } };
  feed?: { title?: string | FeedValue; entry?: FeedEntry | FeedEntry[] };
}

function text(value: string | FeedValue | undefined): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  return value?.['#text']?.trim() || undefined;
}

function link(value: FeedEntry['link']): string | undefined {
  if (typeof value === 'string') return value;
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.find((entry) => entry['@_href'])?.['@_href'];
}

async function readBoundedText(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_FEED_BYTES) {
    throw new Error('Feed response is too large');
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_FEED_BYTES) {
      await reader.cancel();
      throw new Error('Feed response is too large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function createReadRssTool(
  urlValidator: UrlValidator,
  evidenceLedgers: EvidenceLedgerStore,
): RegisteredAgentToolDefinition<ReadRssInput, unknown> {
  return {
    name: 'read_rss',
    description:
      'Read a public RSS or Atom feed and return normalized entries.',
    inputSchema: ReadRssInputSchema,
    permission: 'network.read',
    timeoutMs: 20_000,
    maxResultChars: 50_000,
    execute: async ({ url, limit }, context) => {
      const response = await fetchWithSsrGuard(urlValidator, url, {
        signal: context.signal,
        maxRedirects: 3,
        headers: {
          Accept:
            'application/rss+xml, application/atom+xml, application/xml, text/xml',
        },
      });
      if (!response.ok) {
        throw new Error(`Feed request failed with status ${response.status}`);
      }

      const parsed = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        processEntities: false,
        trimValues: true,
      }).parse(await readBoundedText(response)) as ParsedFeed;
      const feedTitle =
        text(parsed.rss?.channel?.title) ?? text(parsed.feed?.title);
      const rawEntries = parsed.rss?.channel?.item ?? parsed.feed?.entry ?? [];
      const entries = (Array.isArray(rawEntries) ? rawEntries : [rawEntries])
        .slice(0, limit)
        .map((entry) => ({
          title: text(entry.title),
          url: link(entry.link),
          summary:
            text(entry.description) ??
            text(entry.summary) ??
            text(entry.content),
          publishedAt: entry.pubDate ?? entry.published ?? entry.updated,
        }))
        .filter((entry) => entry.url);

      const ledger = evidenceLedgers.get(context.runId);
      const allowed = await Promise.all(
        entries.map((entry) => urlValidator.isAllowed(entry.url!)),
      );
      const publicEntries = entries.filter((_entry, index) => allowed[index]);
      for (const entry of publicEntries) {
        await recordPublicEvidence(ledger, urlValidator, {
          url: entry.url!,
          title: entry.title,
          content: entry.summary ?? '',
          toolName: 'read_rss',
        });
      }

      return { url, title: feedTitle, entries: publicEntries };
    },
  };
}
