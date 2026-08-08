import { describe, expect, it } from 'vitest';
import {
  EvidenceLedger,
  EvidenceLedgerStore,
  normalizeEvidenceUrl,
} from '../evidence-ledger';

describe('EvidenceLedger', () => {
  it('normalizes URLs and hashes the exact Tool content', () => {
    const ledger = new EvidenceLedger('run-1');
    const entry = ledger.record({
      url: 'HTTPS://Example.COM:443/article?b=2&a=1#section',
      title: ' Article ',
      content: 'verified content',
      toolName: 'web_fetch',
      retrievedAt: new Date('2026-08-03T00:00:00.000Z'),
    });

    expect(entry).toEqual({
      normalizedUrl: 'https://example.com/article?a=1&b=2',
      title: 'Article',
      retrievedAt: '2026-08-03T00:00:00.000Z',
      toolName: 'web_fetch',
      contentHash:
        '034311adcf7e54dc9c9d35f583590b4c865b4b7ffa132b2acf9812c5a509f779',
    });
    expect(ledger.hasUrl('https://example.com/article?b=2&a=1#other')).toBe(
      true,
    );
  });

  it('rejects non-web and credential-bearing evidence URLs', () => {
    expect(() => normalizeEvidenceUrl('file:///etc/passwd')).toThrow();
    expect(() => normalizeEvidenceUrl('https://user:pass@example.com')).toThrow();
  });

  it('isolates ledgers by Run and restores validated checkpoints', () => {
    const store = new EvidenceLedgerStore();
    const first = store.create('run-1');
    first.record({
      url: 'https://example.com/one',
      content: 'one',
      toolName: 'web_search',
    });
    const snapshot = first.snapshot();
    const second = store.create('run-2');
    second.restore(snapshot);

    expect(first.hasUrl('https://example.com/one')).toBe(true);
    expect(second.hasUrl('https://example.com/one')).toBe(true);
    expect(() => store.create('run-1')).toThrow('already exists');
    expect(() => second.restore(snapshot)).toThrow('empty ledger');
  });
});
