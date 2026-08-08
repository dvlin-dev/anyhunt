/**
 * [INPUT]: Pi Agent lifecycle events
 * [OUTPUT]: Small runtime event contract without Pi message internals
 * [POS]: The only Pi event translation boundary used by the Anyhunt runner
 */

import type { AgentEvent } from '@earendil-works/pi-agent-core';

export type PiRuntimeEvent =
  | { type: 'text_delta'; delta: string }
  | {
      type: 'tool_call';
      toolCallId: string;
      toolName: string;
      input: unknown;
    }
  | {
      type: 'tool_result';
      toolCallId: string;
      toolName: string;
      isError: boolean;
    }
  | {
      type: 'turn_completed';
      usage: {
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheWriteTokens: number;
        estimatedCostUsd: number;
      };
    };

export function adaptPiEvent(event: AgentEvent): PiRuntimeEvent | undefined {
  if (
    event.type === 'message_update' &&
    event.assistantMessageEvent.type === 'text_delta'
  ) {
    return {
      type: 'text_delta',
      delta: event.assistantMessageEvent.delta,
    };
  }

  if (event.type === 'tool_execution_start') {
    return {
      type: 'tool_call',
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      input: event.args,
    };
  }

  if (event.type === 'tool_execution_end') {
    return {
      type: 'tool_result',
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      isError: event.isError,
    };
  }

  if (event.type === 'turn_end' && event.message.role === 'assistant') {
    return {
      type: 'turn_completed',
      usage: {
        inputTokens: event.message.usage.input,
        outputTokens: event.message.usage.output,
        cacheReadTokens: event.message.usage.cacheRead,
        cacheWriteTokens: event.message.usage.cacheWrite,
        estimatedCostUsd: event.message.usage.cost.total,
      },
    };
  }

  return undefined;
}
