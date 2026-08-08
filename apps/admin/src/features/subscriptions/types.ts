export interface AdminSubscription {
  id: string;
  userId: string;
  topicId: string;
  enabled: boolean;
  subscribedAt: string;
  canceledAt: string | null;
  inboxEnabled: boolean;
  emailEnabled: boolean;
  webhookEnabled: boolean;
  updatedAt: string;
  user: { id: string; email: string; name: string | null };
  topic: { id: string; title: string; slug: string };
}
