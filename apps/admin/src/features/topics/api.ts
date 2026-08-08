import { apiClient } from '@/lib/api-client';
import { ADMIN_API } from '@/lib/api-paths';
import type { AdminPage } from '@/lib/types';
import type { AdminTopic, AdminTopicReport, TopicReportStatus, TopicStatus } from './types';

function pageQuery(page: number, search?: string): string {
  const query = new URLSearchParams({ page: String(page), limit: '20' });
  if (search?.trim()) query.set('search', search.trim());
  return query.toString();
}

export function getTopics(page: number, search?: string): Promise<AdminPage<AdminTopic>> {
  return apiClient.get(`${ADMIN_API.TOPICS}?${pageQuery(page, search)}`);
}

export function getTopicReports(
  page: number,
  status?: TopicReportStatus
): Promise<AdminPage<AdminTopicReport>> {
  const query = new URLSearchParams({ page: String(page), limit: '20' });
  if (status) query.set('status', status);
  return apiClient.get(`${ADMIN_API.TOPIC_REPORTS}?${query.toString()}`);
}

export function setTopicStatus(id: string, status: TopicStatus, reason: string) {
  return apiClient.patch<AdminTopic>(`${ADMIN_API.TOPICS}/${id}/status`, { status, reason });
}

export function resolveTopicReport(
  id: string,
  status: 'RESOLVED_VALID' | 'RESOLVED_INVALID',
  note: string
) {
  return apiClient.patch<AdminTopicReport>(`${ADMIN_API.TOPIC_REPORTS}/${id}`, { status, note });
}
