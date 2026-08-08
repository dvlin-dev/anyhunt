/**
 * [PROVIDES]: Queues 页面常量映射与确认文案
 * [DEPENDS]: QueueName/QueueJobStatus 类型
 * [POS]: Queues 容器与子组件共享配置
 */

import type { QueueJobStatus, QueueName } from './types';

export const QUEUE_LABELS: Record<QueueName, string> = {
  scrape: 'Acquisition',
  'topic-run': 'Topic runs',
  'delivery-email': 'Email delivery',
  'delivery-webhook': 'Webhook delivery',
};

export const QUEUE_STATUS_TABS: Array<{ value: QueueJobStatus; label: string }> = [
  { value: 'waiting', label: 'Waiting' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'delayed', label: 'Delayed' },
];

export type QueueConfirmAction = 'retry' | 'clean-completed' | 'clean-failed';

export function getQueueConfirmDescription(
  action: QueueConfirmAction,
  queueName: QueueName
): string {
  const queueLabel = QUEUE_LABELS[queueName];

  switch (action) {
    case 'retry':
      return `Retry every failed job in the ${queueLabel} queue?`;
    case 'clean-completed':
      return `Remove every completed job from the ${queueLabel} queue?`;
    case 'clean-failed':
      return `Remove every failed job from the ${queueLabel} queue?`;
    default:
      return '';
  }
}
