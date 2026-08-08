import { useMutation, useQuery } from '@tanstack/react-query';
import { exploreApi } from './api';

export const exploreKeys = {
  all: ['explore'] as const,
  list: (page: number) => [...exploreKeys.all, 'list', page] as const,
  topic: (slug: string) => [...exploreKeys.all, 'topic', slug] as const,
  run: (slug: string, runId: string) =>
    [...exploreKeys.all, 'run', slug, runId] as const,
};

export function useExplore(page = 1) {
  return useQuery({
    queryKey: exploreKeys.list(page),
    queryFn: () => exploreApi.list(page),
  });
}

export function usePublicTopic(slug: string) {
  return useQuery({
    queryKey: exploreKeys.topic(slug),
    queryFn: () => exploreApi.get(slug),
    enabled: Boolean(slug),
  });
}

export function usePublicRun(slug: string, runId: string) {
  return useQuery({
    queryKey: exploreKeys.run(slug, runId),
    queryFn: () => exploreApi.getRun(slug, runId),
    enabled: Boolean(slug && runId),
  });
}

export function useReportTopic(topicId: string) {
  return useMutation({
    mutationFn: (input: Parameters<typeof exploreApi.report>[1]) =>
      exploreApi.report(topicId, input),
  });
}
