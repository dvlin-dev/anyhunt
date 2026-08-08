import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  AgentToolRegistryError,
  AgentToolRegistryService,
  type RegisteredAgentToolDefinition,
} from '../agent-tool-registry.service';

function tool(
  overrides: Partial<RegisteredAgentToolDefinition> = {},
): RegisteredAgentToolDefinition {
  return {
    name: 'web_search',
    description: 'Search the public web.',
    inputSchema: z.object({ query: z.string() }),
    permission: 'network.read',
    timeoutMs: 1_000,
    maxResultChars: 1_000,
    execute: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

function context(signal = new AbortController().signal) {
  return {
    runId: 'run-1',
    toolCallId: 'call-1',
    signal,
  };
}

describe('AgentToolRegistryService', () => {
  it('rejects duplicate names and definitions without a usable Zod schema', () => {
    const registry = new AgentToolRegistryService();
    registry.register(tool());

    expect(() => registry.register(tool())).toThrowError(
      expect.objectContaining({ code: 'DUPLICATE_TOOL' }),
    );
    expect(() =>
      new AgentToolRegistryService().register(
        tool({ inputSchema: {} as z.ZodType<unknown> }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_SCHEMA' }));
  });

  it('fails closed when a run does not have the required permission', () => {
    const registry = new AgentToolRegistryService();
    registry.register(tool());
    registry.freeze();

    expect(() =>
      registry.resolveTool('web_search', {
        allowedPermissions: new Set(),
      }),
    ).toThrowError(expect.objectContaining({ code: 'PERMISSION_DENIED' }));
    expect(
      registry.createRunTools({ allowedPermissions: new Set() }),
    ).toEqual([]);
  });

  it('enforces the registered timeout', async () => {
    const registry = new AgentToolRegistryService();
    registry.register(
      tool({
        timeoutMs: 5,
        execute: () => new Promise(() => undefined),
      }),
    );
    registry.freeze();
    const resolved = registry.resolveTool('web_search', {
      allowedPermissions: new Set(['network.read']),
    });

    await expect(
      resolved.execute({ query: 'news' }, context()),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('propagates cancellation through the Tool AbortSignal', async () => {
    const observedSignal = vi.fn();
    const registry = new AgentToolRegistryService();
    registry.register(
      tool({
        execute: async (_input, executionContext) => {
          observedSignal(executionContext.signal);
          await new Promise((_resolve, reject) => {
            executionContext.signal.addEventListener(
              'abort',
              () => reject(new Error('implementation saw abort')),
              { once: true },
            );
          });
        },
      }),
    );
    registry.freeze();
    const controller = new AbortController();
    const resolved = registry.resolveTool('web_search', {
      allowedPermissions: new Set(['network.read']),
    });
    const execution = resolved.execute(
      { query: 'news' },
      context(controller.signal),
    );
    controller.abort();

    await expect(execution).rejects.toMatchObject({ code: 'ABORTED' });
    expect(observedSignal.mock.calls[0]?.[0]).toMatchObject({ aborted: true });
  });

  it('truncates oversized results at the registered boundary', async () => {
    const registry = new AgentToolRegistryService();
    registry.register(
      tool({
        maxResultChars: 40,
        execute: vi.fn().mockResolvedValue({ content: 'x'.repeat(200) }),
      }),
    );
    registry.freeze();
    const resolved = registry.resolveTool('web_search', {
      allowedPermissions: new Set(['network.read']),
    });

    const result = await resolved.execute({ query: 'news' }, context());

    expect(result).toEqual({
      truncated: true,
      content: expect.any(String),
    });
    expect((result as { content: string }).content.length).toBeLessThanOrEqual(
      40,
    );
  });

  it('returns only a redacted, bounded error message', async () => {
    const secret = 'sk-private-value';
    const registry = new AgentToolRegistryService();
    registry.register(
      tool({
        execute: vi.fn().mockRejectedValue(
          Object.assign(new Error(`Upstream rejected ${secret}`), {
            stack: `stack contains ${secret}`,
          }),
        ),
      }),
    );
    registry.freeze();
    const resolved = registry.resolveTool('web_search', {
      allowedPermissions: new Set(['network.read']),
      redactError: (value) => value.replaceAll(secret, '[REDACTED]'),
    });

    const error = await resolved
      .execute({ query: 'news' }, context())
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(AgentToolRegistryError);
    expect(error).toMatchObject({ code: 'EXECUTION_FAILED' });
    expect(String((error as Error).message)).not.toContain(secret);
    expect(String((error as Error).message)).not.toContain('stack contains');
  });

  it('is immutable after startup freeze', () => {
    const registry = new AgentToolRegistryService();
    registry.register(tool());
    registry.freeze();

    expect(() => registry.register(tool({ name: 'web_fetch' }))).toThrowError(
      expect.objectContaining({ code: 'REGISTRY_FROZEN' }),
    );
    expect(() => registry.freeze()).not.toThrow();
  });
});
