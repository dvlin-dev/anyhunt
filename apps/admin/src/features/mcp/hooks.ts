import { useQuery } from '@tanstack/react-query';
import { getMcpStatus } from './api';

export function useMcpStatus() {
  return useQuery({ queryKey: ['admin', 'mcp'], queryFn: getMcpStatus, refetchInterval: 15_000 });
}
