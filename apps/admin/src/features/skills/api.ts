import { apiClient } from '@/lib/api-client';
import { ADMIN_API } from '@/lib/api-paths';
import type { AdminPage } from '@/lib/types';
import type { AdminSkill } from './types';

export function getSkills(page: number, search: string): Promise<AdminPage<AdminSkill>> {
  const query = new URLSearchParams({ page: String(page), limit: '20' });
  if (search.trim()) query.set('search', search.trim());
  return apiClient.get(`${ADMIN_API.SKILLS}?${query.toString()}`);
}
