import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { runsApi } from './api';

export const runKeys = {
  all: ['runs'] as const,
  list: (topicId: string) => [...runKeys.all, 'list', topicId] as const,
  detail: (topicId: string, runId: string) =>
    [...runKeys.all, 'detail', topicId, runId] as const,
};

export function useRuns(topicId: string) {
  return useQuery({
    queryKey: runKeys.list(topicId),
    queryFn: () => runsApi.list(topicId),
    enabled: Boolean(topicId),
    refetchInterval: (query) =>
      query.state.data?.some((run) => ['QUEUED', 'RUNNING'].includes(run.status))
        ? 3_000
        : false,
  });
}

export function useRun(topicId: string, runId: string) {
  return useQuery({
    queryKey: runKeys.detail(topicId, runId),
    queryFn: () => runsApi.get(topicId, runId),
    enabled: Boolean(topicId && runId),
    refetchInterval: (query) =>
      query.state.data && ['QUEUED', 'RUNNING'].includes(query.state.data.status)
        ? 3_000
        : false,
  });
}

export function useTriggerRun(topicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => runsApi.trigger(topicId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: runKeys.list(topicId) }),
  });
}

export function useCancelRun(topicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => runsApi.cancel(topicId, runId),
    onSuccess: (_run, runId) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: runKeys.list(topicId) }),
        queryClient.invalidateQueries({ queryKey: runKeys.detail(topicId, runId) }),
      ]),
  });
}
