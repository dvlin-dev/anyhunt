import { apiClient } from '@/lib/api-client';
import type {
  CreateTopicRequest,
  CreateTopicResponse,
  TopicSummary,
  TopicVisibility,
} from './types';

const TOPICS_PATH = '/api/v1/app/topics';

export const topicsApi = {
  list: () => apiClient.get<TopicSummary[]>(TOPICS_PATH),
  create: (input: CreateTopicRequest) =>
    apiClient.post<CreateTopicResponse>(TOPICS_PATH, input),
  get: (topicId: string) => apiClient.get<TopicSummary>(`${TOPICS_PATH}/${topicId}`),
  update: (topicId: string, input: Partial<CreateTopicRequest> & { description?: string | null }) =>
    apiClient.patch<TopicSummary>(`${TOPICS_PATH}/${topicId}`, input),
  setVisibility: (topicId: string, visibility: TopicVisibility) =>
    apiClient.patch<TopicSummary>(`${TOPICS_PATH}/${topicId}/visibility`, { visibility }),
  pause: (topicId: string) => apiClient.post<TopicSummary>(`${TOPICS_PATH}/${topicId}/pause`),
  resume: (topicId: string) =>
    apiClient.post<TopicSummary>(`${TOPICS_PATH}/${topicId}/resume`),
  fork: (slug: string) => apiClient.post<CreateTopicResponse>(`${TOPICS_PATH}/fork/${slug}`),
};

export const frequencyCron = {
  daily: '0 8 * * *',
  weekdays: '0 8 * * 1-5',
  weekly: '0 8 * * 1',
} as const;
