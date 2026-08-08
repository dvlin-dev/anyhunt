import { apiClient } from '@/lib/api-client';
import { ADMIN_API } from '@/lib/api-paths';
import type { AdminPage } from '@/lib/types';
import type { AdminDelivery } from './types';

export function getDeliveries(page: number): Promise<AdminPage<AdminDelivery>> {
  return apiClient.get(`${ADMIN_API.DELIVERIES}?page=${page}&limit=20`);
}
