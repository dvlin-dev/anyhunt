/**
 * [INPUT]: Server-only ANYHUNT_MCP_SERVERS_JSON environment value
 * [OUTPUT]: Strict allowlisted HTTPS MCP server configuration
 * [POS]: Single deployment-owned MCP configuration boundary
 */

import { z } from 'zod';

const McpNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_-]*$/);

const McpHeadersSchema = z
  .record(z.string().min(1).max(128), z.string().max(8_192))
  .superRefine((headers, context) => {
    const blocked = new Set([
      'connection',
      'content-length',
      'host',
      'proxy-authorization',
      'transfer-encoding',
      'x-forwarded-for',
      'x-forwarded-host',
      'x-forwarded-proto',
    ]);
    for (const name of Object.keys(headers)) {
      if (blocked.has(name.toLowerCase())) {
        context.addIssue({
          code: 'custom',
          message: `MCP header is not allowed: ${name}`,
        });
      }
    }
  });

export const McpServerConfigSchema = z
  .object({
    url: z.url({ protocol: /^https$/ }),
    headers: McpHeadersSchema.default({}),
    tools: z.array(McpNameSchema).min(1).max(100),
    timeoutMs: z.number().int().min(1_000).max(60_000).default(30_000),
    maxResultChars: z.number().int().min(1_000).max(60_000).default(40_000),
  })
  .strict();

export const McpServersConfigSchema = z
  .record(McpNameSchema, McpServerConfigSchema)
  .refine((servers) => Object.keys(servers).length <= 10, {
    message: 'At most 10 MCP servers may be configured',
  });

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;
export type McpServersConfig = z.infer<typeof McpServersConfigSchema>;

export function parseMcpServersConfig(
  value: string | undefined,
): McpServersConfig {
  if (!value?.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('ANYHUNT_MCP_SERVERS_JSON must be valid JSON');
  }
  const result = McpServersConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('ANYHUNT_MCP_SERVERS_JSON is invalid');
  }
  return result.data;
}
