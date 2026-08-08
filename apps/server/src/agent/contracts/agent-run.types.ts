/**
 * [DEFINES]: Framework-neutral limits for one Agent run
 * [USED_BY]: Agent runtime host and runner
 * [POS]: Stable resource boundary shared by runtime implementations
 */

export interface AgentRunLimits {
  timeoutMs: number;
  maxTurns: number;
  maxToolCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxEstimatedCostUsd: number;
}
