import {
  createFauxCore,
  fauxAssistantMessage,
  fauxToolCall,
} from '@earendil-works/pi-ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AgentRunLimits } from '../../contracts/agent-run.types';
import type { AgentToolDefinition } from '../../contracts/agent-tool.types';
import { PiAgentRuntimeService } from '../pi-agent-runtime.service';
import type { ResolvedPiModel } from '../pi-model-resolver.service';

const DEFAULT_LIMITS: AgentRunLimits = {
  timeoutMs: 5_000,
  maxTurns: 5,
  maxToolCalls: 10,
  maxInputTokens: 100_000,
  maxOutputTokens: 10_000,
  maxEstimatedCostUsd: 10,
};

function resolvedFaux(
  faux: ReturnType<typeof createFauxCore>,
  redactError: (value: string) => string = (value) => value,
): ResolvedPiModel {
  return {
    model: faux.getModel(),
    streamFn: faux.streamSimple,
    metadata: {
      providerId: 'faux',
      providerType: 'faux',
      modelId: 'faux-1',
      upstreamModelId: 'faux-1',
    },
    redactError,
  };
}

function createRequest(
  model: ResolvedPiModel,
  overrides: Partial<Parameters<PiAgentRuntimeService['run']>[0]> = {},
): Parameters<PiAgentRuntimeService['run']>[0] {
  return {
    runId: 'run-1',
    systemPrompt: 'Research carefully.',
    prompt: 'Find the latest evidence.',
    model,
    tools: [],
    limits: DEFAULT_LIMITS,
    ...overrides,
  };
}

describe('PiAgentRuntimeService', () => {
  it('streams text deltas and returns the completed text', async () => {
    const faux = createFauxCore({ tokensPerSecond: 0 });
    faux.setResponses([fauxAssistantMessage('Streaming works.')]);
    const onEvent = vi.fn();

    const result = await new PiAgentRuntimeService().run(
      createRequest(resolvedFaux(faux), { onEvent }),
    );

    expect(result.text).toBe('Streaming works.');
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'text_delta' }),
    );
  });

  it('executes a Tool Call and continues into the next model turn', async () => {
    const faux = createFauxCore({ tokensPerSecond: 0 });
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall('echo', { value: 'evidence' }), {
        stopReason: 'toolUse',
      }),
      fauxAssistantMessage('Tool evidence accepted.'),
    ]);
    const execute = vi.fn().mockResolvedValue({ echoed: 'evidence' });
    const tool: AgentToolDefinition<{ value: string }, { echoed: string }> = {
      name: 'echo',
      description: 'Echoes a value.',
      inputSchema: z.object({ value: z.string() }),
      timeoutMs: 1_000,
      execute,
    };
    const events: string[] = [];

    const result = await new PiAgentRuntimeService().run(
      createRequest(resolvedFaux(faux), {
        tools: [tool],
        onEvent: (event) => {
          events.push(event.type);
        },
      }),
    );

    expect(execute).toHaveBeenCalledWith(
      { value: 'evidence' },
      expect.objectContaining({ runId: 'run-1', toolCallId: expect.any(String) }),
    );
    expect(result).toMatchObject({ text: 'Tool evidence accepted.', turns: 2 });
    expect(events).toEqual(
      expect.arrayContaining(['tool_call', 'tool_result', 'text_delta']),
    );
  });

  it('resumes a pending Tool Call from durable messages', async () => {
    const faux = createFauxCore({ tokensPerSecond: 0 });
    faux.setResponses([fauxAssistantMessage('Resumed after the Tool result.')]);
    const execute = vi.fn().mockResolvedValue({ results: ['evidence'] });
    const tool: AgentToolDefinition<{ query: string }, unknown> = {
      name: 'web_search',
      description: 'Search.',
      inputSchema: z.object({ query: z.string() }),
      timeoutMs: 1_000,
      execute,
    };
    const pending = fauxAssistantMessage(
      fauxToolCall('web_search', { query: 'news' }, { id: 'call-pending' }),
      { stopReason: 'toolUse' },
    );

    const result = await new PiAgentRuntimeService().run(
      createRequest(resolvedFaux(faux), {
        tools: [tool],
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Research news.' }],
            timestamp: Date.now(),
          },
          pending,
        ],
      }),
    );

    expect(execute).toHaveBeenCalledWith(
      { query: 'news' },
      expect.objectContaining({ toolCallId: 'call-pending' }),
    );
    expect(result.text).toBe('Resumed after the Tool result.');
    expect(result.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'toolResult',
          toolCallId: 'call-pending',
        }),
      ]),
    );
  });

  it('continues after a durable Tool result without executing it again', async () => {
    const faux = createFauxCore({ tokensPerSecond: 0 });
    faux.setResponses([fauxAssistantMessage('Continued safely.')]);
    const execute = vi.fn();
    const tool: AgentToolDefinition<{ query: string }, unknown> = {
      name: 'web_search',
      description: 'Search.',
      inputSchema: z.object({ query: z.string() }),
      timeoutMs: 1_000,
      execute,
    };
    const assistant = fauxAssistantMessage(
      fauxToolCall('web_search', { query: 'news' }, { id: 'call-complete' }),
      { stopReason: 'toolUse' },
    );

    const result = await new PiAgentRuntimeService().run(
      createRequest(resolvedFaux(faux), {
        tools: [tool],
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Research news.' }],
            timestamp: Date.now(),
          },
          assistant,
          {
            role: 'toolResult',
            toolCallId: 'call-complete',
            toolName: 'web_search',
            content: [{ type: 'text', text: '{"results":[]}' }],
            details: {},
            isError: false,
            timestamp: Date.now(),
          },
        ],
      }),
    );

    expect(execute).not.toHaveBeenCalled();
    expect(result.text).toBe('Continued safely.');
  });

  it('honors an external AbortSignal', async () => {
    const faux = createFauxCore({ tokensPerSecond: 100 });
    faux.setResponses([fauxAssistantMessage('A response that takes time.')]);
    const controller = new AbortController();

    const promise = new PiAgentRuntimeService().run(
      createRequest(resolvedFaux(faux), {
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'text_delta') controller.abort();
        },
      }),
    );

    await expect(promise).rejects.toMatchObject({
      code: 'ABORTED',
    });
  });

  it('enforces the run timeout', async () => {
    const faux = createFauxCore({ tokensPerSecond: 100 });
    faux.setResponses([fauxAssistantMessage('A response that takes time.')]);

    await expect(
      new PiAgentRuntimeService().run(
        createRequest(resolvedFaux(faux), {
          limits: { ...DEFAULT_LIMITS, timeoutMs: 5 },
        }),
      ),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('enforces turn, Tool Call, output-token, and cost limits', async () => {
    const echo: AgentToolDefinition<{ value: string }, { value: string }> = {
      name: 'echo',
      description: 'Echo a value.',
      inputSchema: z.object({ value: z.string() }),
      timeoutMs: 1_000,
      execute: async (input) => input,
    };

    const turnFaux = createFauxCore({ tokensPerSecond: 0 });
    turnFaux.setResponses([
      fauxAssistantMessage(fauxToolCall('echo', { value: 'one' }), {
        stopReason: 'toolUse',
      }),
      fauxAssistantMessage('Second turn.'),
    ]);
    await expect(
      new PiAgentRuntimeService().run(
        createRequest(resolvedFaux(turnFaux), {
          tools: [echo],
          limits: { ...DEFAULT_LIMITS, maxTurns: 1 },
        }),
      ),
    ).rejects.toMatchObject({ code: 'RESOURCE_LIMIT' });

    const toolFaux = createFauxCore({ tokensPerSecond: 0 });
    toolFaux.setResponses([
      fauxAssistantMessage(
        [
          fauxToolCall('echo', { value: 'one' }),
          fauxToolCall('echo', { value: 'two' }),
        ],
        { stopReason: 'toolUse' },
      ),
    ]);
    await expect(
      new PiAgentRuntimeService().run(
        createRequest(resolvedFaux(toolFaux), {
          tools: [echo],
          limits: { ...DEFAULT_LIMITS, maxToolCalls: 1 },
        }),
      ),
    ).rejects.toMatchObject({ code: 'RESOURCE_LIMIT' });

    const usageFaux = createFauxCore({
      tokensPerSecond: 0,
      models: [
        {
          id: 'faux-costly',
          cost: {
            input: 100_000,
            output: 100_000,
            cacheRead: 100_000,
            cacheWrite: 100_000,
          },
        },
      ],
    });
    usageFaux.setResponses([fauxAssistantMessage('Costly response.')]);
    await expect(
      new PiAgentRuntimeService().run(
        createRequest(resolvedFaux(usageFaux), {
          limits: {
            ...DEFAULT_LIMITS,
            maxOutputTokens: 1,
            maxEstimatedCostUsd: 0.000_001,
          },
        }),
      ),
    ).rejects.toMatchObject({ code: 'RESOURCE_LIMIT' });
  });

  it('maps context overflow and Provider failures to safe errors', async () => {
    const contextFaux = createFauxCore({ tokensPerSecond: 0 });
    contextFaux.setResponses([
      fauxAssistantMessage([], {
        stopReason: 'error',
        errorMessage: 'Input exceeds the model maximum context length',
      }),
    ]);
    await expect(
      new PiAgentRuntimeService().run(
        createRequest(resolvedFaux(contextFaux)),
      ),
    ).rejects.toMatchObject({
      code: 'CONTEXT_LIMIT',
    });

    const secret = 'sk-sensitive-provider-key';
    const providerFaux = createFauxCore({ tokensPerSecond: 0 });
    providerFaux.setResponses([
      fauxAssistantMessage([], {
        stopReason: 'error',
        errorMessage: `Provider rejected ${secret}`,
      }),
    ]);
    const error = await new PiAgentRuntimeService()
      .run(
        createRequest(
          resolvedFaux(providerFaux, (value) =>
            value.replaceAll(secret, '[REDACTED]'),
          ),
        ),
      )
      .catch((cause: unknown) => cause);

    expect(error).toMatchObject({ code: 'PROVIDER_ERROR' });
    expect(String((error as Error).message)).not.toContain(secret);
  });
});
