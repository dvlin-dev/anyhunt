import { useQuery } from '@tanstack/react-query';
import { getSkills } from './api';

export function useAdminSkills(page: number, search: string) {
  return useQuery({ queryKey: ['admin', 'skills', page, search], queryFn: () => getSkills(page, search) });
}
