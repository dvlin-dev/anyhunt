import { useQuery } from '@tanstack/react-query';
import { getDeliveries } from './api';

export function useAdminDeliveries(page: number) {
  return useQuery({ queryKey: ['admin', 'deliveries', page], queryFn: () => getDeliveries(page), refetchInterval: 5000 });
}
