import { useQuery } from '@tanstack/react-query';
import { getSubscriptions } from './api';

export function useAdminSubscriptions(page: number) {
  return useQuery({
    queryKey: ['admin', 'subscriptions', page],
    queryFn: () => getSubscriptions(page),
  });
}
