import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UrlValidator } from '../../../common/validators/url.validator';
import { AgentToolRegistryService } from '../../tools/agent-tool-registry.service';
import { EvidenceLedgerStore } from '../../tools/evidence-ledger';
import type { McpServersConfig } from '../mcp.config';
import {
  createSafeMcpFetch,
  McpClientManagerService,
  type McpConnection,
  type McpConnectionFactory,
} from '../mcp-client-manager.service';

const CONFIG: McpServersConfig = {
  research: {
    url: 'https://mcp.example.com/mcp',
    headers: {},
    tools: ['search'],
    timeoutMs: 5_000,
    maxResultChars: 8_000,
  },
};

describe('McpClientManagerService', () => {
  it('registers only allowlisted Tools with fixed permission and budget', async () => {
    const callTool = vi.fn().mockResolvedValue({
      structuredContent: {
        items: [
          {
            url: 'https://example.com/result',
            title: 'Result',
            summary: 'Evidence from MCP.',
          },
        ],
        permission: 'run.submit',
        timeoutMs: 999_999,
      },
      content: [{ type: 'text', text: 'Found one result.' }],
    });
    const close = vi.fn().mockResolvedValue(undefined);
    const connection: McpConnection = {
      listTools: vi.fn().mockResolvedValue({
        tools: [
          {
            name: 'search',
            description: 'Search a configured source.',
            inputSchema: {
              type: 'object',
              properties: { query: { type: 'string', minLength: 1 } },
              required: ['query'],
              additionalProperties: false,
            },
          },
          {
            name: 'dangerous',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      }),
      callTool,
      close,
    };
    const factory: McpConnectionFactory = vi.fn().mockResolvedValue(connection);
    const isAllowed = vi.fn().mockResolvedValue(true);
    const ledgers = new EvidenceLedgerStore();
    ledgers.create('run-1');
    const manager = new McpClientManagerService(
      CONFIG,
      { isAllowed } as unknown as UrlValidator,
      ledgers,
      factory,
    );

    const definitions = await manager.initialize();

    expect(definitions).toHaveLength(1);
    expect(manager.getStatus()).toEqual({
      servers: [{ name: 'research', status: 'connected', tools: ['search'] }],
    });
    expect(definitions[0]).toMatchObject({
      name: 'mcp.research.search',
      permission: 'mcp.invoke',
      timeoutMs: 5_000,
      maxResultChars: 8_000,
    });
    const registry = new AgentToolRegistryService();
    registry.register(definitions[0]!);
    registry.freeze();
    const tool = registry.resolveTool('mcp.research.search', {
      allowedPermissions: new Set(['mcp.invoke']),
    });
    await expect(
      tool.execute(
        { query: 'news', permission: 'run.submit', timeoutMs: 999_999 },
        {
          runId: 'run-1',
          toolCallId: 'call-1',
          signal: new AbortController().signal,
        },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await tool.execute(
      { query: 'news' },
      {
        runId: 'run-1',
        toolCallId: 'call-2',
        signal: new AbortController().signal,
      },
    );
    expect(callTool).toHaveBeenCalledWith(
      'search',
      { query: 'news' },
      expect.any(AbortSignal),
      5_000,
    );
    expect(ledgers.get('run-1').hasUrl('https://example.com/result')).toBe(
      true,
    );
    await manager.close();
    expect(close).toHaveBeenCalledOnce();
    expect(manager.getStatus().servers[0]?.status).toBe('disconnected');
  });

  it('fails closed when an allowlisted Tool is missing', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const factory: McpConnectionFactory = vi.fn().mockResolvedValue({
      listTools: vi.fn().mockResolvedValue({ tools: [] }),
      callTool: vi.fn(),
      close,
    } satisfies McpConnection);
    const ledgers = new EvidenceLedgerStore();
    const manager = new McpClientManagerService(
      CONFIG,
      { isAllowed: vi.fn().mockResolvedValue(true) } as unknown as UrlValidator,
      ledgers,
      factory,
    );

    await expect(manager.initialize()).rejects.toThrow('was not found');
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('createSafeMcpFetch', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('revalidates redirect targets with the shared SSRF guard', async () => {
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
      createSafeMcpFetch({ isAllowed } as unknown as UrlValidator)(
        'https://mcp.example.com/mcp',
      ),
    ).rejects.toThrow('Outbound URL is not allowed');
    expect(isAllowed).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
