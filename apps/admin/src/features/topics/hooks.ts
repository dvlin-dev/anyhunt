import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getTopicReports, getTopics, resolveTopicReport, setTopicStatus } from './api';
import type { TopicReportStatus, TopicStatus } from './types';

export const topicKeys = {
  all: ['admin', 'topics'] as const,
  list: (page: number, search: string) => [...topicKeys.all, 'list', page, search] as const,
  reports: (page: number, status?: TopicReportStatus) =>
    [...topicKeys.all, 'reports', page, status ?? 'all'] as const,
};

export function useAdminTopics(page: number, search: string) {
  return useQuery({
    queryKey: topicKeys.list(page, search),
    queryFn: () => getTopics(page, search),
  });
}

export function useAdminTopicReports(page: number, status?: TopicReportStatus) {
  return useQuery({
    queryKey: topicKeys.reports(page, status),
    queryFn: () => getTopicReports(page, status),
  });
}

export function useSetTopicStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: TopicStatus; reason: string }) =>
      setTopicStatus(input.id, input.status, input.reason),
    onSuccess: async () => {
      toast.success('Topic status updated');
      await client.invalidateQueries({ queryKey: topicKeys.all });
    },
    onError: () => toast.error('Failed to update Topic status'),
  });
}

export function useResolveTopicReport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      status: 'RESOLVED_VALID' | 'RESOLVED_INVALID';
      note: string;
    }) => resolveTopicReport(input.id, input.status, input.note),
    onSuccess: async () => {
      toast.success('Report reviewed');
      await client.invalidateQueries({ queryKey: topicKeys.all });
    },
    onError: () => toast.error('Failed to review report'),
  });
}
