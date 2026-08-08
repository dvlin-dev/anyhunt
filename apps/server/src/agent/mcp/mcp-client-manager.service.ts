/**
 * [INPUT]: Deployment-owned MCP config, shared SSRF guard, and per-run Evidence Ledger
 * [OUTPUT]: Fixed MCP Tools adapted to the runtime-neutral Tool contract
 * [POS]: Lifecycle owner for configured Streamable HTTP MCP clients
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { UrlValidator } from '../../common/validators/url.validator';
import { fetchWithSsrGuard } from '../../common/utils/ssrf-fetch';
import type { RegisteredAgentToolDefinition } from '../tools/agent-tool-registry.service';
import type { EvidenceLedgerStore } from '../tools/evidence-ledger';
import { recordPublicEvidence } from '../tools/evidence-ledger';
import type { McpServerConfig, McpServersConfig } from './mcp.config';
import { mcpJsonSchemaToZod } from './mcp-json-schema';

interface ListedMcpTool {
  name: string;
  description?: string;
  inputSchema: unknown;
}

interface McpToolResult {
  content?: unknown[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface McpConnection {
  listTools(cursor?: string): Promise<{
    tools: ListedMcpTool[];
    nextCursor?: string;
  }>;
  callTool(
    name: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
    timeoutMs: number,
  ): Promise<McpToolResult>;
  close(): Promise<void>;
}

export type McpConnectionFactory = (
  config: McpServerConfig,
  urlValidator: UrlValidator,
) => Promise<McpConnection>;

export function createSafeMcpFetch(urlValidator: UrlValidator) {
  return (url: string | URL, init?: RequestInit) =>
    fetchWithSsrGuard(urlValidator, url.toString(), {
      ...init,
      maxRedirects: 3,
    });
}

async function createSdkConnection(
  config: McpServerConfig,
  urlValidator: UrlValidator,
): Promise<McpConnection> {
  const client = new Client(
    { name: 'anyhunt', version: '1.0.0' },
    { enforceStrictCapabilities: true },
  );
  const transport = new StreamableHTTPClientTransport(new URL(config.url), {
    requestInit: { headers: config.headers },
    fetch: createSafeMcpFetch(urlValidator),
  });
  await client.connect(transport, { timeout: config.timeoutMs });
  return {
    listTools: (cursor) =>
      client.listTools(cursor ? { cursor } : undefined, {
        timeout: config.timeoutMs,
      }),
    callTool: async (name, args, signal, timeoutMs) => {
      const result = await client.callTool(
        { name, arguments: args },
        undefined,
        { signal, timeout: timeoutMs, maxTotalTimeout: timeoutMs },
      );
      if (!('content' in result) || !Array.isArray(result.content)) {
        throw new Error(
          'Task-based MCP Tools are not supported in Anyhunt 1.0',
        );
      }
      return result as McpToolResult;
    },
    close: () => client.close(),
  };
}

function normalizeMcpResult(result: McpToolResult): Record<string, unknown> {
  const content: Array<Record<string, unknown>> = [];
  for (const item of result.content ?? []) {
    if (!item || typeof item !== 'object') continue;
    const value = item as Record<string, unknown>;
    if (value.type === 'text' && typeof value.text === 'string') {
      content.push({ type: 'text', text: value.text });
      continue;
    }
    if (
      value.type === 'resource' &&
      value.resource &&
      typeof value.resource === 'object'
    ) {
      const resource = value.resource as Record<string, unknown>;
      content.push({
        type: 'resource',
        uri: typeof resource.uri === 'string' ? resource.uri : undefined,
        text: typeof resource.text === 'string' ? resource.text : undefined,
      });
      continue;
    }
    content.push({
      type: typeof value.type === 'string' ? value.type : 'unsupported',
      omitted: true,
    });
  }
  return {
    isError: result.isError === true,
    content,
    structuredContent: result.structuredContent,
  };
}

function collectEvidenceCandidates(
  value: unknown,
  output: Array<{ url: string; title?: string; content: string }>,
  depth = 0,
): void {
  if (depth > 6 || output.length >= 100 || !value) return;
  if (Array.isArray(value)) {
    for (const child of value)
      collectEvidenceCandidates(child, output, depth + 1);
    return;
  }
  if (typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  const evidenceUrl =
    typeof record.url === 'string'
      ? record.url
      : typeof record.uri === 'string'
        ? record.uri
        : undefined;
  if (evidenceUrl) {
    output.push({
      url: evidenceUrl,
      title: typeof record.title === 'string' ? record.title : undefined,
      content:
        ['content', 'text', 'summary', 'description']
          .map((key) => record[key])
          .find(
            (candidate): candidate is string => typeof candidate === 'string',
          ) ?? JSON.stringify(record),
    });
  }
  for (const child of Object.values(record)) {
    collectEvidenceCandidates(child, output, depth + 1);
  }
}

export class McpClientManagerService {
  private readonly connections: McpConnection[] = [];
  private readonly connectedServers = new Set<string>();

  constructor(
    private readonly config: McpServersConfig,
    private readonly urlValidator: UrlValidator,
    private readonly evidenceLedgers: EvidenceLedgerStore,
    private readonly connectionFactory: McpConnectionFactory = createSdkConnection,
  ) {}

  async initialize(): Promise<RegisteredAgentToolDefinition[]> {
    const definitions: RegisteredAgentToolDefinition[] = [];
    try {
      for (const [serverName, server] of Object.entries(this.config)) {
        if (!(await this.urlValidator.isAllowed(server.url))) {
          throw new Error(
            `Configured MCP server is not allowed: ${serverName}`,
          );
        }
        const connection = await this.connectionFactory(
          server,
          this.urlValidator,
        );
        this.connections.push(connection);
        const discovered: ListedMcpTool[] = [];
        let cursor: string | undefined;
        for (let page = 0; page < 5; page += 1) {
          const response = await connection.listTools(cursor);
          discovered.push(...response.tools);
          cursor = response.nextCursor;
          if (!cursor) break;
        }
        if (cursor || discovered.length > 100) {
          throw new Error(
            `Configured MCP server exposes too many Tools: ${serverName}`,
          );
        }

        const byName = new Map(discovered.map((tool) => [tool.name, tool]));
        for (const toolName of server.tools) {
          const remote = byName.get(toolName);
          if (!remote) {
            throw new Error(
              `Configured MCP Tool was not found: ${serverName}.${toolName}`,
            );
          }
          definitions.push(
            this.adaptTool(serverName, server, connection, remote),
          );
        }
        this.connectedServers.add(serverName);
      }
      return definitions;
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async close(): Promise<void> {
    const connections = this.connections.splice(0);
    this.connectedServers.clear();
    await Promise.allSettled(
      connections.map((connection) => connection.close()),
    );
  }

  getStatus() {
    return {
      servers: Object.entries(this.config).map(([name, server]) => ({
        name,
        status: this.connectedServers.has(name) ? 'connected' : 'disconnected',
        tools: [...server.tools],
      })),
    };
  }

  private adaptTool(
    serverName: string,
    server: McpServerConfig,
    connection: McpConnection,
    remote: ListedMcpTool,
  ): RegisteredAgentToolDefinition<Record<string, unknown>, unknown> {
    const name = `mcp.${serverName}.${remote.name}`;
    const inputSchema = mcpJsonSchemaToZod(remote.inputSchema);
    return {
      name,
      description:
        `Call the configured ${serverName} MCP Tool ${remote.name}. ${
          remote.description?.slice(0, 500) ?? ''
        }`.trim(),
      inputSchema,
      permission: 'mcp.invoke',
      timeoutMs: server.timeoutMs,
      maxResultChars: server.maxResultChars,
      execute: async (input, context) => {
        const result = normalizeMcpResult(
          await connection.callTool(
            remote.name,
            input,
            context.signal,
            server.timeoutMs,
          ),
        );
        const candidates: Array<{
          url: string;
          title?: string;
          content: string;
        }> = [];
        if (result.isError !== true) {
          collectEvidenceCandidates(result.content, candidates);
          collectEvidenceCandidates(result.structuredContent, candidates);
        }
        const ledger = this.evidenceLedgers.get(context.runId);
        for (const candidate of candidates) {
          try {
            await recordPublicEvidence(ledger, this.urlValidator, {
              ...candidate,
              toolName: name,
            });
          } catch {
            // Untrusted result URLs are omitted from evidence without failing useful Tool output.
          }
        }
        return result;
      },
    };
  }
}
