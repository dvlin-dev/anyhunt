/**
 * [INPUT]: Configured Agent limits and persisted checkpoint usage
 * [OUTPUT]: Remaining limits or null when any resource is exhausted
 * [POS]: Pure resource-budget calculation for Agent Runner
 */

import type { AgentRunLimits } from '../contracts/agent-run.types';
import type { AgentCheckpointBudget } from './agent-checkpoint.service';

export const EMPTY_AGENT_BUDGET: AgentCheckpointBudget = {
  turns: 0,
  toolCalls: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  estimatedCostUsd: 0,
  elapsedMs: 0,
};

export function remainingRunLimits(
  limits: AgentRunLimits,
  budget: AgentCheckpointBudget,
): AgentRunLimits | null {
  const remaining = {
    timeoutMs: limits.timeoutMs - budget.elapsedMs,
    maxTurns: limits.maxTurns - budget.turns,
    maxToolCalls: limits.maxToolCalls - budget.toolCalls,
    maxInputTokens:
      limits.maxInputTokens - budget.inputTokens - budget.cacheReadTokens,
    maxOutputTokens: limits.maxOutputTokens - budget.outputTokens,
    maxEstimatedCostUsd: limits.maxEstimatedCostUsd - budget.estimatedCostUsd,
  };
  return Object.values(remaining).some(
    (value) => !Number.isFinite(value) || value <= 0,
  )
    ? null
    : remaining;
}
