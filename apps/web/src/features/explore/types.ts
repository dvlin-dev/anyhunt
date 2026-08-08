import type { RunItem } from '../runs/types';

export interface PublicTopicRun {
  id: string;
  completedAt: string;
  narrative: string | null;
  items: RunItem[];
}

export interface PublicTopic {
  id: string;
  slug: string;
  title: string;
  goal: string;
  description?: string | null;
  locale?: string;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  subscriberCount: number;
  latestRun: PublicTopicRun | null;
}

export interface PublicTopicListResponse {
  items: Array<Omit<PublicTopic, 'latestRun' | 'subscriberCount'> & {
    _count: { subscriptions: number };
  }>;
  page: number;
  limit: number;
  total: number;
}
