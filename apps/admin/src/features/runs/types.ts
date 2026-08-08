export interface AdminRun {
  id: string;
  topicId: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'EMPTY' | 'FAILED' | 'CANCELED';
  trigger: 'INITIAL' | 'MANUAL' | 'SCHEDULED';
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelRequestedAt: string | null;
  runtimeStats: unknown;
  errorCode: string | null;
  createdAt: string;
  updatedAt?: string;
  _count: { items: number; deliveries: number };
}

export interface RunDiagnostics {
  modelId: string | null;
  tools: Array<{ name: string; count: number }>;
  toolCalls: number;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  resumed: boolean;
}
