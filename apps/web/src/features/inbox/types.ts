export interface InboxItem {
  id: string;
  canonicalUrlHash: string;
  title: string;
  url: string;
  summary: string;
  selectionReason: string;
  state: { isRead: boolean; isSaved: boolean; isNotInterested: boolean };
  run: {
    id?: string;
    completedAt?: string;
    narrative?: string | null;
    topic: { id?: string; slug?: string; title: string };
  };
}

export interface InboxResponse {
  items: InboxItem[];
  page: number;
  limit: number;
  total: number;
}

export interface InboxFilters {
  page?: number;
  limit?: number;
  topicId?: string;
  isRead?: boolean;
  isSaved?: boolean;
  isNotInterested?: boolean;
}
