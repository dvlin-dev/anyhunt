/**
 * [INPUT]: Resolved Pi model, framework-neutral Tools, prompt, limits, and AbortSignal
 * [OUTPUT]: Unified runtime events and a bounded run result
 * [POS]: Thin Pi Agent lifecycle adapter; contains no Topic persistence or business retry
 */

import { Injectable } from '@nestjs/common';
import type {
  AgentMessage,
  AgentTool,
  AgentToolResult,
} from '@earendil-works/pi-agent-core';
import type { AssistantMessage } from '@earendil-works/pi-ai';
import { z } from 'zod';
import type { AgentRunLimits } from '../contracts/agent-run.types';
import type {
  AgentToolContext,
  AgentToolDefinition,
} from '../contracts/agent-tool.types';
import { adaptPiEvent, type PiRuntimeEvent } from './pi-event-adapter';
import { loadPiAgentCore, loadPiAi } from './pi-esm-loader';
import type { ResolvedPiModel } from './pi-model-resolver.service';

export type PiRuntimeErrorCode =
  'ABORTED' | 'TIMEOUT' | 'CONTEXT_LIMIT' | 'PROVIDER_ERROR' | 'RESOURCE_LIMIT';

export class PiRuntimeError extends Error {
  constructor(
    readonly code: PiRuntimeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PiRuntimeError';
  }
}

export interface PiAgentRunRequest {
  runId: string;
  systemPrompt: string;
  prompt: string;
  messages?: readonly unknown[];
  model: ResolvedPiModel;
  tools: AgentToolDefinition<unknown, unknown>[];
  limits: AgentRunLimits;
  signal?: AbortSignal;
  onEvent?: (event: PiRuntimeEvent) => void | Promise<void>;
  onState?: (state: PiRuntimeStateSnapshot) => void | Promise<void>;
}

export interface PiRuntimeStateSnapshot {
  phase: 'model_response' | 'tool_result';
  messages: readonly unknown[];
  completedToolCallId?: string;
  completedToolName?: string;
}

export interface PiAgentRunResult {
  text: string;
  turns: number;
  toolCalls: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    estimatedCostUsd: number;
  };
  messages: readonly unknown[];
}

type RuntimeUsage = PiAgentRunResult['usage'];

function createEmptyUsage(): RuntimeUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    estimatedCostUsd: 0,
  };
}

function addUsage(total: RuntimeUsage, message: AssistantMessage): void {
  total.inputTokens += message.usage.input;
  total.outputTokens += message.usage.output;
  total.cacheReadTokens += message.usage.cacheRead;
  total.cacheWriteTokens += message.usage.cacheWrite;
  total.estimatedCostUsd += message.usage.cost.total;
}

function finalAssistantText(messages: AgentMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'assistant') continue;
    return message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');
  }
  return '';
}

function safeToolOutput(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return '[Unserializable tool result]';
  }
}

function createToolSignal(
  parentSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  parentSignal?.addEventListener('abort', abort, { once: true });

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      parentSignal?.removeEventListener('abort', abort);
    },
  };
}

async function executeUntilAborted<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) throw new Error('Tool execution was aborted');

  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new Error('Tool execution was aborted'));
    signal.addEventListener('abort', abort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(
          error instanceof Error ? error : new Error('Tool execution failed'),
        );
      },
    );
  });
}

function adaptTools(
  runId: string,
  tools: AgentToolDefinition<unknown, unknown>[],
): AgentTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    label: tool.name,
    description: tool.description,
    parameters: z.toJSONSchema(tool.inputSchema),
    prepareArguments: (input: unknown) => tool.inputSchema.parse(input),
    execute: async (
      toolCallId: string,
      input: unknown,
      parentSignal?: AbortSignal,
    ): Promise<AgentToolResult<unknown>> => {
      const toolSignal = createToolSignal(parentSignal, tool.timeoutMs);
      const context: AgentToolContext = {
        runId,
        toolCallId,
        signal: toolSignal.signal,
      };

      try {
        const output = await executeUntilAborted(
          tool.execute(input, context),
          toolSignal.signal,
        );
        return {
          content: [{ type: 'text', text: safeToolOutput(output) }],
          details: output,
        };
      } finally {
        toolSignal.dispose();
      }
    },
    executionMode: 'sequential',
  }));
}

function lastMessage(messages: AgentMessage[]): AgentMessage | undefined {
  return messages[messages.length - 1];
}

function pendingToolCalls(message: AgentMessage | undefined): Array<{
  id: string;
  name: string;
  arguments: unknown;
}> {
  if (!message || message.role !== 'assistant') return [];
  return message.content.flatMap((block) =>
    block.type === 'toolCall'
      ? [{ id: block.id, name: block.name, arguments: block.arguments }]
      : [],
  );
}

function validateLimits(limits: AgentRunLimits): void {
  const values = Object.values(limits);
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new PiRuntimeError(
      'RESOURCE_LIMIT',
      'Agent run limits must be positive finite numbers',
    );
  }
}

function hasContextOverflowMessage(message: AssistantMessage): boolean {
  return /context (?:length|window)|input token count exceeds|prompt is too long/i.test(
    message.errorMessage ?? '',
  );
}

@Injectable()
export class PiAgentRuntimeService {
  async run(request: PiAgentRunRequest): Promise<PiAgentRunResult> {
    validateLimits(request.limits);

    if (request.signal?.aborted) {
      throw new PiRuntimeError('ABORTED', 'Agent run was canceled');
    }

    const serializedMessages = request.messages?.length
      ? JSON.stringify(request.messages)
      : request.prompt;
    const estimatedInputTokens = Math.ceil(
      (request.systemPrompt.length + serializedMessages.length) / 4,
    );
    const inputLimit = Math.min(
      request.limits.maxInputTokens,
      request.model.model.contextWindow,
    );
    if (estimatedInputTokens > inputLimit) {
      throw new PiRuntimeError(
        'CONTEXT_LIMIT',
        'Agent input exceeds the configured context limit',
      );
    }

    const [{ Agent }, { isContextOverflow }] = await Promise.all([
      loadPiAgentCore(),
      loadPiAi(),
    ]);
    const usage = createEmptyUsage();
    let turns = 0;
    let toolCalls = 0;
    let timedOut = false;
    let externallyAborted = false;
    let runError: PiRuntimeError | undefined;
    const replayController = new AbortController();
    const piTools = adaptTools(request.runId, request.tools);
    const resumedMessages = structuredClone(
      request.messages ?? [],
    ) as AgentMessage[];

    const agent = new Agent({
      initialState: {
        systemPrompt: request.systemPrompt,
        model: request.model.model,
        tools: piTools,
        messages: resumedMessages,
      },
      streamFn: request.model.streamFn,
      toolExecution: 'sequential',
      maxRetryDelayMs: 5_000,
    });

    const abortFromCaller = () => {
      externallyAborted = true;
      replayController.abort();
      agent.abort();
    };
    request.signal?.addEventListener('abort', abortFromCaller, { once: true });

    const timeout = setTimeout(() => {
      timedOut = true;
      replayController.abort();
      agent.abort();
    }, request.limits.timeoutMs);

    agent.subscribe(async (event) => {
      if (event.type === 'turn_start') {
        turns += 1;
        if (turns > request.limits.maxTurns) {
          runError ??= new PiRuntimeError(
            'RESOURCE_LIMIT',
            'Agent exceeded the maximum turn count',
          );
          agent.abort();
        }
      }

      if (event.type === 'tool_execution_start') {
        toolCalls += 1;
        if (toolCalls > request.limits.maxToolCalls) {
          runError ??= new PiRuntimeError(
            'RESOURCE_LIMIT',
            'Agent exceeded the maximum Tool Call count',
          );
          agent.abort();
        }
      }

      if (event.type === 'turn_end' && event.message.role === 'assistant') {
        addUsage(usage, event.message);

        if (
          isContextOverflow(event.message, request.model.model.contextWindow) ||
          hasContextOverflowMessage(event.message)
        ) {
          runError ??= new PiRuntimeError(
            'CONTEXT_LIMIT',
            'Provider rejected the Agent context as too large',
          );
        } else if (
          event.message.stopReason === 'error' &&
          event.message.errorMessage
        ) {
          runError ??= new PiRuntimeError(
            'PROVIDER_ERROR',
            request.model.redactError(event.message.errorMessage),
          );
        }

        if (
          usage.inputTokens + usage.cacheReadTokens >
            request.limits.maxInputTokens ||
          usage.outputTokens > request.limits.maxOutputTokens ||
          usage.estimatedCostUsd > request.limits.maxEstimatedCostUsd
        ) {
          runError ??= new PiRuntimeError(
            'RESOURCE_LIMIT',
            'Agent exceeded a configured token or cost limit',
          );
          agent.abort();
        }
      }

      const adapted = adaptPiEvent(event);
      if (adapted) await request.onEvent?.(adapted);
      if (event.type === 'message_end' && event.message.role === 'assistant') {
        await request.onState?.({
          phase: 'model_response',
          messages: structuredClone(agent.state.messages),
        });
      }
      if (event.type === 'message_end' && event.message.role === 'toolResult') {
        await request.onState?.({
          phase: 'tool_result',
          messages: structuredClone(agent.state.messages),
          completedToolCallId: event.message.toolCallId,
          completedToolName: event.message.toolName,
        });
      }
    });

    try {
      const resumeCalls = pendingToolCalls(lastMessage(agent.state.messages));
      if (resumeCalls.length > 0) {
        for (const call of resumeCalls) {
          toolCalls += 1;
          if (toolCalls > request.limits.maxToolCalls) {
            throw new PiRuntimeError(
              'RESOURCE_LIMIT',
              'Agent exceeded the maximum Tool Call count',
            );
          }
          await request.onEvent?.({
            type: 'tool_call',
            toolCallId: call.id,
            toolName: call.name,
            input: call.arguments,
          });
          const tool = piTools.find(
            (candidate) => candidate.name === call.name,
          );
          let result: AgentToolResult<unknown>;
          let isError = false;
          try {
            if (!tool) throw new Error('Tool not found');
            const input = tool.prepareArguments
              ? tool.prepareArguments(call.arguments)
              : call.arguments;
            result = await tool.execute(
              call.id,
              input,
              replayController.signal,
            );
          } catch (error) {
            isError = true;
            result = {
              content: [
                {
                  type: 'text',
                  text:
                    error instanceof Error
                      ? error.message
                      : 'Tool execution failed',
                },
              ],
              details: {},
            };
          }
          const toolResult: AgentMessage = {
            role: 'toolResult',
            toolCallId: call.id,
            toolName: call.name,
            content: result.content,
            details: result.details,
            usage: result.usage,
            isError,
            timestamp: Date.now(),
          };
          agent.state.messages = [...agent.state.messages, toolResult];
          await request.onEvent?.({
            type: 'tool_result',
            toolCallId: call.id,
            toolName: call.name,
            isError,
          });
          await request.onState?.({
            phase: 'tool_result',
            messages: structuredClone(agent.state.messages),
            completedToolCallId: call.id,
            completedToolName: call.name,
          });
        }
        await agent.continue();
      } else if (agent.state.messages.length > 0) {
        const last = lastMessage(agent.state.messages);
        if (last?.role === 'assistant') {
          await agent.prompt(
            'Complete the task now. Submit the final Digest if it has not been submitted.',
          );
        } else {
          await agent.continue();
        }
      } else {
        await agent.prompt(request.prompt);
      }
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener('abort', abortFromCaller);
    }

    if (timedOut) {
      throw new PiRuntimeError('TIMEOUT', 'Agent run timed out');
    }
    if (externallyAborted) {
      throw new PiRuntimeError('ABORTED', 'Agent run was canceled');
    }
    if (runError) throw runError;
    if (agent.state.errorMessage) {
      throw new PiRuntimeError(
        'PROVIDER_ERROR',
        request.model.redactError(agent.state.errorMessage),
      );
    }

    return {
      text: finalAssistantText(agent.state.messages),
      turns,
      toolCalls,
      usage,
      messages: structuredClone(agent.state.messages),
    };
  }
}
