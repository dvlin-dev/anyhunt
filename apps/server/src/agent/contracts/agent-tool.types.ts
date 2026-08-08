/**
 * [DEFINES]: Framework-neutral Agent Tool execution contract
 * [USED_BY]: Tool registry and Agent runtime adapters
 * [POS]: Stable boundary between runtime, tools, and cancellation
 */

import type { z } from 'zod';

export interface AgentToolContext {
  runId: string;
  toolCallId: string;
  signal: AbortSignal;
}

export interface AgentToolDefinition<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  timeoutMs: number;
  execute(input: TInput, context: AgentToolContext): Promise<TOutput>;
}
