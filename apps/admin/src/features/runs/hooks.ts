import { useQuery } from '@tanstack/react-query';
import { getRuns } from './api';

export function useAdminRuns(page: number) {
  return useQuery({ queryKey: ['admin', 'runs', page], queryFn: () => getRuns(page), refetchInterval: 5000 });
}
