export type RunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'EMPTY'
  | 'FAILED'
  | 'CANCELED';

export interface RunItem {
  canonicalUrlHash: string;
  title: string;
  url: string;
  summary: string;
  selectionReason: string;
  rank: number;
  retrievedAt: string;
  sourceTitle?: string | null;
}

export interface TopicRun {
  id: string;
  status: RunStatus;
  trigger: 'INITIAL' | 'SCHEDULED' | 'MANUAL';
  scheduledAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelRequestedAt?: string | null;
  narrative?: string | null;
  emptyReason?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  items?: RunItem[];
  _count?: { items: number };
}
