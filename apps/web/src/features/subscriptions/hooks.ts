import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '../inbox/hooks';
import { subscriptionsApi } from './api';
import type { SubscriptionPreferences } from './types';

export const subscriptionKeys = {
  all: ['subscriptions'] as const,
  list: () => [...subscriptionKeys.all, 'list'] as const,
};

export function useSubscriptions(enabled = true) {
  return useQuery({
    queryKey: subscriptionKeys.list(),
    queryFn: subscriptionsApi.list,
    enabled,
  });
}

export function useSubscribe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: subscriptionsApi.subscribe,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.all }),
        queryClient.invalidateQueries({ queryKey: inboxKeys.all }),
      ]),
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: subscriptionsApi.cancel,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.all }),
        queryClient.invalidateQueries({ queryKey: inboxKeys.all }),
      ]),
  });
}

export function useSubscriptionPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      topicId,
      preferences,
    }: {
      topicId: string;
      preferences: SubscriptionPreferences;
    }) => subscriptionsApi.updatePreferences(topicId, preferences),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all }),
  });
}
