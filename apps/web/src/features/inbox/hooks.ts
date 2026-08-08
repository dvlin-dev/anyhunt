import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inboxApi } from './api';
import type { InboxFilters } from './types';

export const inboxKeys = {
  all: ['inbox'] as const,
  list: (filters: InboxFilters) => [...inboxKeys.all, 'list', filters] as const,
};

export function useInbox(filters: InboxFilters) {
  return useQuery({
    queryKey: inboxKeys.list(filters),
    queryFn: () => inboxApi.list(filters),
  });
}

export function useInboxState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      canonicalUrlHash,
      state,
    }: {
      canonicalUrlHash: string;
      state: Partial<{
        isRead: boolean;
        isSaved: boolean;
        isNotInterested: boolean;
      }>;
    }) => inboxApi.updateState(canonicalUrlHash, state),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxKeys.all }),
  });
}
