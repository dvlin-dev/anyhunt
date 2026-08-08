import type { RunDiagnostics } from './types';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function toRunDiagnostics(value: unknown): RunDiagnostics {
  const stats = record(value);
  const model = record(stats.model);
  const usage = record(stats.usage);
  const tools = Object.entries(record(stats.tools))
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));

  return {
    modelId: typeof model.modelId === 'string' ? model.modelId : null,
    tools,
    toolCalls: finiteNumber(stats.toolCalls),
    turns: finiteNumber(stats.turns),
    inputTokens: finiteNumber(usage.inputTokens),
    outputTokens: finiteNumber(usage.outputTokens),
    estimatedCostUsd: finiteNumber(usage.estimatedCostUsd),
    resumed: stats.resumed === true,
  };
}

export function runDurationMs(startedAt: string | null, completedAt: string | null): number | null {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : null;
}
