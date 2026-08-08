/** Admin Topic 与举报的最小运营投影。 */

export type TopicStatus = 'ACTIVE' | 'SUSPENDED';

export interface AdminTopic {
  id: string;
  ownerId: string;
  slug: string;
  title: string;
  visibility: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
  status: TopicStatus;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
  owner: { id: string; email: string; name: string | null };
  managedSkill: {
    id: string;
    name: string;
    enabled: boolean;
    currentVersion: number;
    updatedAt: string;
  } | null;
  _count: { subscriptions: number; runs: number };
}

export type TopicReportStatus =
  | 'PENDING'
  | 'RESOLVED_VALID'
  | 'RESOLVED_INVALID'
  | 'DISMISSED';

export interface AdminTopicReport {
  id: string;
  reason: string;
  description: string | null;
  status: TopicReportStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  topic: {
    id: string;
    slug: string;
    title: string;
    status: TopicStatus;
    ownerId: string;
  };
  reporter: { id: string; email: string };
  resolvedBy: { id: string; email: string } | null;
}
