export interface Subscription {
  id: string;
  topicId: string;
  enabled: boolean;
  subscribedAt?: string;
  canceledAt?: string | null;
  inboxEnabled: boolean;
  emailEnabled: boolean;
  webhookEnabled: boolean;
  webhookUrl?: string | null;
  topic: {
    id?: string;
    slug: string;
    title: string;
    visibility?: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
    status?: 'ACTIVE' | 'SUSPENDED';
  };
}

export interface SubscriptionPreferences {
  inboxEnabled?: boolean;
  emailEnabled?: boolean;
  webhookEnabled?: boolean;
  webhookUrl?: string;
  webhookSecret?: string;
}
