import { apiClient } from '@/lib/api-client';
import type { InboxFilters, InboxResponse } from './types';

const INBOX_PATH = '/api/v1/app/inbox';

export const inboxApi = {
  list: (filters: InboxFilters) =>
    apiClient.get<InboxResponse>(INBOX_PATH, { query: { ...filters } }),
  updateState: (
    canonicalUrlHash: string,
    state: Partial<{
      isRead: boolean;
      isSaved: boolean;
      isNotInterested: boolean;
    }>,
  ) =>
    apiClient.patch(`${INBOX_PATH}/${canonicalUrlHash}/state`, state),
};
