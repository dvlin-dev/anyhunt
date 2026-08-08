import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { runKeys } from '../runs/hooks';
import { topicsApi, frequencyCron } from './api';
import type { TopicCreateValues, TopicVisibility } from './types';

export const topicKeys = {
  all: ['topics'] as const,
  list: () => [...topicKeys.all, 'list'] as const,
  detail: (topicId: string) => [...topicKeys.all, 'detail', topicId] as const,
};

export function useTopics() {
  return useQuery({ queryKey: topicKeys.list(), queryFn: topicsApi.list });
}

export function useTopic(topicId: string) {
  return useQuery({
    queryKey: topicKeys.detail(topicId),
    queryFn: () => topicsApi.get(topicId),
    enabled: Boolean(topicId),
  });
}

export function useCreateTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: TopicCreateValues) =>
      topicsApi.create({
        title: values.title,
        goal: values.goal,
        cron: frequencyCron[values.frequency],
        timezone: values.timezone,
        locale: values.locale,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: topicKeys.list() }),
  });
}

export function useTopicVisibility(topicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (visibility: TopicVisibility) =>
      topicsApi.setVisibility(topicId, visibility),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: topicKeys.detail(topicId) }),
        queryClient.invalidateQueries({ queryKey: topicKeys.list() }),
      ]),
  });
}

export function useTopicEnabled(topicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      enabled ? topicsApi.resume(topicId) : topicsApi.pause(topicId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: topicKeys.detail(topicId) }),
        queryClient.invalidateQueries({ queryKey: topicKeys.list() }),
        queryClient.invalidateQueries({ queryKey: runKeys.list(topicId) }),
      ]),
  });
}
