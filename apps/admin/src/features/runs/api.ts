import { apiClient } from '@/lib/api-client';
import { ADMIN_API } from '@/lib/api-paths';
import type { AdminPage } from '@/lib/types';
import type { AdminRun } from './types';

export function getRuns(page: number): Promise<AdminPage<AdminRun>> {
  return apiClient.get(`${ADMIN_API.RUNS}?page=${page}&limit=20`);
}
