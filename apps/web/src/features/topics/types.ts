import type { TopicRun } from '../runs/types';

export type TopicVisibility = 'PRIVATE' | 'UNLISTED' | 'PUBLIC';

export interface SkillSummary {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  currentVersion?: number;
}

export interface TopicSummary {
  id: string;
  slug: string;
  title: string;
  goal: string;
  description?: string | null;
  visibility: TopicVisibility;
  status: 'ACTIVE' | 'SUSPENDED';
  locale: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  managedSkill?: SkillSummary | null;
  attachedSkills?: SkillSummary[];
  _count?: { subscriptions: number; runs: number };
}

export interface CreateTopicRequest {
  title: string;
  goal: string;
  cron: string;
  timezone: string;
  locale: string;
}

export interface CreateTopicResponse {
  topic: TopicSummary;
  initialRun: TopicRun;
}

export interface TopicCreateValues {
  title: string;
  goal: string;
  frequency: 'daily' | 'weekdays' | 'weekly';
  timezone: string;
  locale: string;
}
