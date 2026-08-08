import { apiClient } from '@/lib/api-client';
import type { Skill } from './types';

const SKILLS_PATH = '/api/v1/app/skills';

export const skillsApi = {
  list: () => apiClient.get<Skill[]>(SKILLS_PATH),
  get: (skillId: string) => apiClient.get<Skill>(`${SKILLS_PATH}/${skillId}`),
  importUrl: (url: string) =>
    apiClient.post<{ created: boolean; skill: Skill }>(`${SKILLS_PATH}/import-url`, {
      url,
    }),
  importFile: (file: File) => {
    const form = new FormData();
    form.set('file', file);
    return apiClient.post<{ created: boolean; skill: Skill }>(`${SKILLS_PATH}/import`, form);
  },
  setEnabled: (skillId: string, enabled: boolean) =>
    apiClient.patch<Skill>(`${SKILLS_PATH}/${skillId}/status`, { enabled }),
  rollback: (skillId: string, version: number) =>
    apiClient.post<Skill>(`${SKILLS_PATH}/${skillId}/rollback`, { version }),
  archive: (skillId: string) => apiClient.delete<void>(`${SKILLS_PATH}/${skillId}`),
  attach: (skillId: string, topicId: string) =>
    apiClient.post(`${SKILLS_PATH}/${skillId}/topics/${topicId}`),
  detach: (skillId: string, topicId: string) =>
    apiClient.delete(`${SKILLS_PATH}/${skillId}/topics/${topicId}`),
  exportUrl: (skillId: string) => `${SKILLS_PATH}/${skillId}/export`,
  download: async (skillId: string) => {
    const response = await apiClient.raw(`${SKILLS_PATH}/${skillId}/export`);
    if (!response.ok) throw new Error('Skill export failed');
    return response.blob();
  },
};
