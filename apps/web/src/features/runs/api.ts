import { apiClient } from '@/lib/api-client';
import type { TopicRun } from './types';

const runBase = (topicId: string) => `/api/v1/app/topics/${topicId}/runs`;

export const runsApi = {
  list: (topicId: string) => apiClient.get<TopicRun[]>(runBase(topicId)),
  get: (topicId: string, runId: string) =>
    apiClient.get<TopicRun>(`${runBase(topicId)}/${runId}`),
  trigger: (topicId: string) =>
    apiClient.post<TopicRun>(runBase(topicId), undefined, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    }),
  cancel: (topicId: string, runId: string) =>
    apiClient.post<TopicRun>(`${runBase(topicId)}/${runId}/cancel`),
};
