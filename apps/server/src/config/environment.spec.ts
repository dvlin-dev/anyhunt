import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment';

const validProductionEnvironment = () => ({
  NODE_ENV: 'production',
  PORT: '3000',
  DATABASE_URL: 'postgresql://app:password@postgres:5432/anyhunt',
  REDIS_URL: 'redis://redis:6379',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'https://server.anyhunt.app',
  TRUSTED_ORIGINS: 'https://anyhunt.app,https://*.anyhunt.app',
  ANYHUNT_WWW_URL: 'https://anyhunt.app',
  ANYHUNT_LLM_SECRET_KEY: Buffer.alloc(32, 1).toString('base64'),
  ANYHUNT_DATA_SECRET_KEY: Buffer.alloc(32, 2).toString('base64'),
  SEARXNG_URL: 'http://searxng:8080',
});

describe('validateEnvironment', () => {
  it('accepts the complete production contract with MCP disabled', () => {
    const result = validateEnvironment(validProductionEnvironment());

    expect(result).toMatchObject({
      NODE_ENV: 'production',
      PORT: 3000,
    });
    expect(result).not.toHaveProperty('ANYHUNT_MCP_SERVERS_JSON');
  });

  it.each([
    'DATABASE_URL',
    'REDIS_URL',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'TRUSTED_ORIGINS',
    'ANYHUNT_WWW_URL',
    'ANYHUNT_LLM_SECRET_KEY',
    'ANYHUNT_DATA_SECRET_KEY',
    'SEARXNG_URL',
  ] as const)('fails production startup without %s', (key) => {
    const env = validProductionEnvironment();
    delete env[key];

    expect(() => validateEnvironment(env)).toThrow(key);
  });

  it('rejects malformed URLs, keys, origins, and MCP JSON without echoing values', () => {
    const env = {
      ...validProductionEnvironment(),
      DATABASE_URL: 'not-a-database-secret-value',
      TRUSTED_ORIGINS: 'javascript:private-origin-value',
      ANYHUNT_LLM_SECRET_KEY: 'private-llm-key-value',
      ANYHUNT_MCP_SERVERS_JSON: 'private-invalid-json',
    };

    const error = (() => {
      try {
        validateEnvironment(env);
      } catch (cause) {
        return cause as Error;
      }
      throw new Error('Expected validation to fail');
    })();

    expect(error.message).toContain('DATABASE_URL');
    expect(error.message).toContain('TRUSTED_ORIGINS');
    expect(error.message).toContain('ANYHUNT_LLM_SECRET_KEY');
    expect(error.message).toContain('ANYHUNT_MCP_SERVERS_JSON');
    expect(error.message).not.toContain('private');
  });

  it('validates provided values outside production without requiring services', () => {
    expect(validateEnvironment({ NODE_ENV: 'test' })).toMatchObject({
      NODE_ENV: 'test',
    });
    expect(() =>
      validateEnvironment({ NODE_ENV: 'development', REDIS_URL: 'http://bad' }),
    ).toThrow('REDIS_URL');
    expect(() =>
      validateEnvironment({ NODE_ENV: 'development', SMTP_URL: 'http://bad' }),
    ).toThrow('SMTP_URL');
  });

  it('normalizes an empty optional SMTP URL from deployment platforms', () => {
    const result = validateEnvironment({
      ...validProductionEnvironment(),
      SMTP_URL: '',
    });

    expect(result.SMTP_URL).toBeUndefined();
  });
});
