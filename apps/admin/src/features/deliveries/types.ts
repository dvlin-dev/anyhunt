export interface AdminDelivery {
  id: string;
  runId: string;
  subscriptionId: string;
  channel: 'EMAIL' | 'WEBHOOK';
  status: 'PENDING' | 'DELIVERED' | 'FAILED';
  attemptCount: number;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
}
