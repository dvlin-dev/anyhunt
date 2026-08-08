import { describe, expect, it } from 'vitest';
import { parseMcpServersConfig } from '../mcp.config';

describe('parseMcpServersConfig', () => {
  it('accepts a strict server-owned HTTPS allowlist and applies bounds', () => {
    expect(
      parseMcpServersConfig(
        JSON.stringify({
          research: {
            url: 'https://mcp.example.com/mcp',
            headers: { Authorization: 'Bearer deployment-secret' },
            tools: ['search'],
          },
        }),
      ),
    ).toEqual({
      research: {
        url: 'https://mcp.example.com/mcp',
        headers: { Authorization: 'Bearer deployment-secret' },
        tools: ['search'],
        timeoutMs: 30_000,
        maxResultChars: 40_000,
      },
    });
    expect(parseMcpServersConfig(undefined)).toEqual({});
  });

  it.each([
    ['invalid JSON', '{'],
    [
      'non-HTTPS URL',
      JSON.stringify({ local: { url: 'http://127.0.0.1/mcp', tools: ['read'] } }),
    ],
    [
      'missing Tool allowlist',
      JSON.stringify({ remote: { url: 'https://mcp.example.com/mcp' } }),
    ],
    [
      'forged forwarding header',
      JSON.stringify({
        remote: {
          url: 'https://mcp.example.com/mcp',
          tools: ['read'],
          headers: { Host: 'metadata.google.internal' },
        },
      }),
    ],
  ])('rejects %s', (_label, value) => {
    expect(() => parseMcpServersConfig(value)).toThrow();
  });
});
