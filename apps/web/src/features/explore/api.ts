import { apiClient } from '@/lib/api-client';
import type { PublicTopic, PublicTopicListResponse, PublicTopicRun } from './types';

const PUBLIC_TOPICS_PATH = '/api/v1/topics';

type PublicTopicApiResponse = Omit<PublicTopic, 'subscriberCount' | 'latestRun'> & {
  _count: { subscriptions: number };
  runs: PublicTopicRun[];
};

function normalizeTopic(topic: PublicTopicApiResponse): PublicTopic {
  return {
    ...topic,
    subscriberCount: topic._count.subscriptions,
    latestRun: topic.runs[0] ?? null,
  };
}

export const exploreApi = {
  list: (page = 1) =>
    apiClient.get<PublicTopicListResponse>(PUBLIC_TOPICS_PATH, {
      query: { page, limit: 20 },
    }),
  get: async (slug: string) =>
    normalizeTopic(await apiClient.get<PublicTopicApiResponse>(`${PUBLIC_TOPICS_PATH}/${slug}`)),
  getRun: (slug: string, runId: string) =>
    apiClient.get<{ topic: PublicTopicApiResponse; run: PublicTopicRun }>(
      `${PUBLIC_TOPICS_PATH}/${slug}/runs/${runId}`,
    ),
  report: (
    topicId: string,
    input: {
      reason: 'SPAM' | 'COPYRIGHT' | 'INAPPROPRIATE' | 'MISLEADING' | 'OTHER';
      description?: string;
    },
  ) => apiClient.post(`/api/v1/app/topics/${topicId}/report`, input),
};
