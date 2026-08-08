import { describe, expect, it } from 'vitest';
import { mcpJsonSchemaToZod } from '../mcp-json-schema';

describe('mcpJsonSchemaToZod', () => {
  it('converts the bounded common MCP input subset', () => {
    const schema = mcpJsonSchemaToZod({
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1, maxLength: 100 },
        limit: { type: 'integer', minimum: 1, maximum: 10 },
        tags: { type: 'array', items: { type: 'string' }, maxItems: 5 },
      },
      required: ['query'],
      additionalProperties: false,
    });

    expect(schema.safeParse({ query: 'news', limit: 5 }).success).toBe(true);
    expect(schema.safeParse({ query: '', budget: 999 }).success).toBe(false);
  });

  it.each([
    { type: 'string' },
    { type: 'object', properties: { value: { anyOf: [{ type: 'string' }] } } },
    { type: 'object', properties: { value: { type: 'array' } } },
  ])('fails closed for unsupported schema %#', (schema) => {
    expect(() => mcpJsonSchemaToZod(schema)).toThrow();
  });
});
