/**
 * [INPUT]: Server process environment
 * [OUTPUT]: Validated configuration with production fail-closed requirements
 * [POS]: Single startup validation boundary; error messages contain names, never values
 */

import { z } from 'zod';

function hasProtocol(value: string, protocols: readonly string[]): boolean {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const HttpUrlSchema = z
  .url()
  .refine((value) => hasProtocol(value, ['http:', 'https:']));

const DatabaseUrlSchema = z
  .url()
  .refine((value) => hasProtocol(value, ['postgres:', 'postgresql:']));

const RedisUrlSchema = z
  .url()
  .refine((value) => hasProtocol(value, ['redis:', 'rediss:']));

const SmtpUrlSchema = z
  .url()
  .refine((value) => hasProtocol(value, ['smtp:', 'smtps:']));

const OptionalSmtpUrlSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  SmtpUrlSchema.optional(),
);

const Base64KeySchema = z.string().refine((value) => {
  try {
    return Buffer.from(value, 'base64').length === 32;
  } catch {
    return false;
  }
});

const EnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
    PORT: z.coerce.number().int().min(1).max(65_535).optional(),
    DATABASE_URL: DatabaseUrlSchema.optional(),
    REDIS_URL: RedisUrlSchema.optional(),
    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    BETTER_AUTH_URL: HttpUrlSchema.optional(),
    TRUSTED_ORIGINS: z.string().min(1).optional(),
    ANYHUNT_WWW_URL: HttpUrlSchema.optional(),
    ANYHUNT_LLM_SECRET_KEY: Base64KeySchema.optional(),
    ANYHUNT_DATA_SECRET_KEY: Base64KeySchema.optional(),
    SEARXNG_URL: HttpUrlSchema.optional(),
    SMTP_URL: OptionalSmtpUrlSchema,
    ANYHUNT_LOCAL_WEBHOOK_SINK_URL: HttpUrlSchema.optional(),
    ANYHUNT_MCP_SERVERS_JSON: z.string().optional(),
  })
  .passthrough();

const PRODUCTION_REQUIRED_KEYS = [
  'DATABASE_URL',
  'REDIS_URL',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'TRUSTED_ORIGINS',
  'ANYHUNT_WWW_URL',
  'ANYHUNT_LLM_SECRET_KEY',
  'ANYHUNT_DATA_SECRET_KEY',
  'SEARXNG_URL',
] as const;

function validateOrigins(value: string | undefined): boolean {
  if (!value) return false;
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .every((origin) => {
      try {
        const normalized = origin.replace('://*.', '://wildcard.');
        return HttpUrlSchema.safeParse(normalized).success;
      } catch {
        return false;
      }
    });
}

function validateOptionalMcpJson(value: string | undefined): boolean {
  if (!value?.trim()) return true;
  try {
    const parsed: unknown = JSON.parse(value);
    return (
      Boolean(parsed) && !Array.isArray(parsed) && typeof parsed === 'object'
    );
  } catch {
    return false;
  }
}

export function validateEnvironment(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const result = EnvironmentSchema.safeParse(raw);
  const invalid = new Set<string>();
  if (!result.success) {
    for (const issue of result.error.issues) {
      invalid.add(String(issue.path[0] ?? 'environment'));
    }
  }
  const env = result.success ? result.data : raw;
  if (raw.NODE_ENV === 'production') {
    for (const key of PRODUCTION_REQUIRED_KEYS) {
      const value = raw[key];
      if (typeof value !== 'string' || !value.trim()) invalid.add(key);
    }
    if (!validateOrigins(raw.TRUSTED_ORIGINS as string | undefined)) {
      invalid.add('TRUSTED_ORIGINS');
    }
  }
  if (
    !validateOptionalMcpJson(raw.ANYHUNT_MCP_SERVERS_JSON as string | undefined)
  ) {
    invalid.add('ANYHUNT_MCP_SERVERS_JSON');
  }

  if (invalid.size > 0) {
    throw new Error(
      `Invalid or missing environment variables: ${[...invalid].sort().join(', ')}`,
    );
  }
  return env;
}
