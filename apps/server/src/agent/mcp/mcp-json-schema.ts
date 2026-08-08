/**
 * [INPUT]: Bounded MCP Tool JSON Schema
 * [OUTPUT]: Equivalent Zod input schema for Pi and runtime validation
 * [POS]: Fail-closed support for the common MCP input schema subset
 */

import { z } from 'zod';

type JsonSchema = Record<string, unknown>;

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function convert(schema: JsonSchema, depth: number): z.ZodType<unknown> {
  if (depth > 8) throw new Error('MCP Tool schema is too deep');
  if (Array.isArray(schema.enum)) {
    const values = schema.enum;
    if (
      values.length === 0 ||
      values.length > 100 ||
      !values.every((value): value is string => typeof value === 'string')
    ) {
      throw new Error('MCP Tool enum is unsupported');
    }
    return z.enum(values as [string, ...string[]]);
  }

  switch (schema.type) {
    case 'object': {
      const rawProperties = schema.properties ?? {};
      if (
        !rawProperties ||
        Array.isArray(rawProperties) ||
        typeof rawProperties !== 'object'
      ) {
        throw new Error('MCP Tool object properties are invalid');
      }
      const properties = Object.entries(rawProperties);
      if (properties.length > 50) {
        throw new Error('MCP Tool schema has too many properties');
      }
      const required = new Set(
        Array.isArray(schema.required)
          ? schema.required.filter(
              (value): value is string => typeof value === 'string',
            )
          : [],
      );
      const shape: Record<string, z.ZodType<unknown>> = {};
      for (const [name, child] of properties) {
        if (!child || Array.isArray(child) || typeof child !== 'object') {
          throw new Error('MCP Tool property schema is invalid');
        }
        const converted = convert(child as JsonSchema, depth + 1);
        shape[name] = required.has(name) ? converted : converted.optional();
      }
      return schema.additionalProperties === true
        ? z.looseObject(shape)
        : z.strictObject(shape);
    }
    case 'array': {
      if (
        !schema.items ||
        Array.isArray(schema.items) ||
        typeof schema.items !== 'object'
      ) {
        throw new Error('MCP Tool array items are invalid');
      }
      let result = z.array(convert(schema.items as JsonSchema, depth + 1));
      const min = finiteNumber(schema.minItems);
      const max = finiteNumber(schema.maxItems);
      if (min !== undefined) result = result.min(Math.max(0, Math.trunc(min)));
      result = result.max(Math.min(100, Math.max(0, Math.trunc(max ?? 100))));
      return result;
    }
    case 'string': {
      let result = z.string();
      const min = finiteNumber(schema.minLength);
      const max = finiteNumber(schema.maxLength);
      if (min !== undefined) result = result.min(Math.max(0, Math.trunc(min)));
      result = result.max(
        Math.min(10_000, Math.max(0, Math.trunc(max ?? 10_000))),
      );
      return result;
    }
    case 'integer': {
      let result = z.number().int();
      const min = finiteNumber(schema.minimum);
      const max = finiteNumber(schema.maximum);
      if (min !== undefined) result = result.min(min);
      if (max !== undefined) result = result.max(max);
      return result;
    }
    case 'number': {
      let result = z.number();
      const min = finiteNumber(schema.minimum);
      const max = finiteNumber(schema.maximum);
      if (min !== undefined) result = result.min(min);
      if (max !== undefined) result = result.max(max);
      return result;
    }
    case 'boolean':
      return z.boolean();
    case 'null':
      return z.null();
    default:
      throw new Error(
        'MCP Tool schema uses an unsupported JSON Schema feature',
      );
  }
}

export function mcpJsonSchemaToZod(
  value: unknown,
): z.ZodType<Record<string, unknown>> {
  const serialized = JSON.stringify(value);
  if (!serialized || serialized.length > 32_768) {
    throw new Error('MCP Tool schema is too large');
  }
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('MCP Tool schema must be an object');
  }
  const schema = value as JsonSchema;
  if (schema.type !== 'object') {
    throw new Error('MCP Tool input schema must have object type');
  }
  return convert(schema, 0) as z.ZodType<Record<string, unknown>>;
}
