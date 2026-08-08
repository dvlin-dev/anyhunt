import { apiClient } from '@/lib/api-client';
import type { Subscription, SubscriptionPreferences } from './types';

const SUBSCRIPTIONS_PATH = '/api/v1/app/subscriptions';

export const subscriptionsApi = {
  list: () => apiClient.get<Subscription[]>(SUBSCRIPTIONS_PATH),
  subscribe: (topicId: string) =>
    apiClient.post<Subscription>(`${SUBSCRIPTIONS_PATH}/${topicId}`),
  cancel: (topicId: string) =>
    apiClient.delete<Subscription>(`${SUBSCRIPTIONS_PATH}/${topicId}`),
  updatePreferences: (topicId: string, preferences: SubscriptionPreferences) =>
    apiClient.patch<Subscription>(
      `${SUBSCRIPTIONS_PATH}/${topicId}/preferences`,
      preferences,
    ),
};
