import { lookup } from 'node:dns/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UrlValidator as UrlValidatorType } from '../../../common/validators/url.validator';
import { fetchWithSsrGuard } from '../../../common/utils/ssrf-fetch';
import { AgentToolRegistryService } from '../../tools/agent-tool-registry.service';
import {
  EvidenceLedger,
  EvidenceLedgerStore,
  normalizeEvidenceUrl,
} from '../../tools/evidence-ledger';
import { createReadRssTool } from '../../tools/read-rss.tool';
import {
  createSubmitDigestTool,
  DigestSubmissionStore,
} from '../../tools/submit-digest.tool';

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));

const lookupMock = vi.mocked(lookup);

function context(runId = 'run-1') {
  return {
    runId,
    toolCallId: 'call-1',
    signal: new AbortController().signal,
  };
}

function resolve(
  definition: Parameters<AgentToolRegistryService['register']>[0],
) {
  const registry = new AgentToolRegistryService();
  registry.register(definition);
  registry.freeze();
  return registry.resolveTool(definition.name, {
    allowedPermissions: new Set([definition.permission]),
  });
}

describe('URL and Evidence Ledger security', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    lookupMock.mockReset();
  });

  it('blocks private, reserved, metadata, credential, and mixed DNS targets', async () => {
    lookupMock.mockImplementation(async (hostname) => {
      if (hostname === 'mixed.example') {
        return [
          { address: '93.184.216.34', family: 4 },
          { address: '10.0.0.1', family: 4 },
        ] as never;
      }
      return [{ address: String(hostname), family: 4 }] as never;
    });
    const { UrlValidator } = await import(
      '../../../common/validators/url.validator'
    );
    const validator = new UrlValidator();

    await expect(validator.isAllowed('http://127.0.0.1')).resolves.toBe(false);
    await expect(validator.isAllowed('http://169.254.169.254')).resolves.toBe(
      false,
    );
    await expect(validator.isAllowed('http://192.0.2.1')).resolves.toBe(false);
    await expect(
      validator.isAllowed('http://metadata.google.internal/latest/meta-data'),
    ).resolves.toBe(false);
    await expect(
      validator.isAllowed('https://user:pass@example.com/private'),
    ).resolves.toBe(false);
    await expect(validator.isAllowed('https://mixed.example')).resolves.toBe(
      false,
    );
  });

  it('re-resolves every request and fails closed on DNS rebinding', async () => {
    lookupMock
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }] as never)
      .mockResolvedValueOnce([{ address: '10.0.0.8', family: 4 }] as never);
    const { UrlValidator } = await import(
      '../../../common/validators/url.validator'
    );
    const validator = new UrlValidator();

    await expect(validator.isAllowed('https://rebind.example')).resolves.toBe(
      true,
    );
    await expect(validator.isAllowed('https://rebind.example')).resolves.toBe(
      false,
    );
    expect(lookupMock).toHaveBeenCalledTimes(2);
  });

  it('revalidates redirects before issuing the next request', async () => {
    const isAllowed = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const fetcher = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/private' },
      }),
    );
    vi.stubGlobal('fetch', fetcher);

    await expect(
      fetchWithSsrGuard(
        { isAllowed } as unknown as UrlValidatorType,
        'https://public.example/start',
      ),
    ).rejects.toThrow('Outbound URL is not allowed');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(isAllowed).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1/private',
    );
  });

  it('normalizes fragments without confusing Unicode homographs', () => {
    expect(
      normalizeEvidenceUrl('https://example.com/article?b=2&a=1#forged'),
    ).toBe('https://example.com/article?a=1&b=2');
    expect(normalizeEvidenceUrl('https://exаmple.com/article')).toBe(
      'https://xn--exmple-4nf.com/article',
    );
    expect(normalizeEvidenceUrl('https://exаmple.com/article')).not.toBe(
      normalizeEvidenceUrl('https://example.com/article'),
    );
    expect(() =>
      normalizeEvidenceUrl('http://[::ffff:127.0.0.1]/private'),
    ).toThrow('public host');
  });

  it('rejects oversized responses before parsing or recording evidence', async () => {
    const ledgers = new EvidenceLedgerStore();
    ledgers.create('run-1');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('small body', {
          status: 200,
          headers: { 'content-length': String(1024 * 1024 + 1) },
        }),
      ),
    );
    const tool = resolve(
      createReadRssTool(
        { isAllowed: vi.fn().mockResolvedValue(true) } as unknown as UrlValidatorType,
        ledgers,
      ),
    );

    await expect(
      tool.execute({ url: 'https://example.com/feed.xml' }, context()),
    ).rejects.toMatchObject({ code: 'EXECUTION_FAILED' });
    expect(ledgers.get('run-1').snapshot()).toEqual([]);
  });

  it('rejects forged, private, and another Run ledger URLs at submission', async () => {
    const ledgers = new EvidenceLedgerStore();
    ledgers.create('run-1').record({
      url: 'https://example.com/allowed',
      content: 'evidence',
      toolName: 'web_fetch',
    });
    ledgers.create('run-2').record({
      url: 'https://example.com/other-run',
      content: 'other evidence',
      toolName: 'web_fetch',
    });
    const tool = resolve(
      createSubmitDigestTool(ledgers, new DigestSubmissionStore()),
    );
    const item = (url: string) => ({
      narrative: 'Update.',
      items: [
        {
          url,
          title: 'Claim',
          summary: 'Summary.',
          selectionReason: 'Relevant.',
        },
      ],
    });

    await expect(
      tool.execute(item('https://example.com/forged'), context()),
    ).rejects.toMatchObject({ code: 'EXECUTION_FAILED' });
    await expect(
      tool.execute(item('https://example.com/other-run'), context()),
    ).rejects.toMatchObject({ code: 'EXECUTION_FAILED' });
    await expect(
      tool.execute(item('http://127.0.0.1/private'), context()),
    ).rejects.toMatchObject({ code: 'EXECUTION_FAILED' });
    expect(() =>
      new EvidenceLedger('run-private').record({
        url: 'http://10.0.0.1/private',
        content: 'not evidence',
        toolName: 'mcp.remote.search',
      }),
    ).toThrow('public host');
  });
});
