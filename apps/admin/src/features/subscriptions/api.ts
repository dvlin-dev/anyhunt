import { apiClient } from '@/lib/api-client';
import { ADMIN_API } from '@/lib/api-paths';
import type { AdminPage } from '@/lib/types';
import type { AdminSubscription } from './types';

export function getSubscriptions(page: number): Promise<AdminPage<AdminSubscription>> {
  return apiClient.get(`${ADMIN_API.SUBSCRIPTIONS}?page=${page}&limit=20`);
}
