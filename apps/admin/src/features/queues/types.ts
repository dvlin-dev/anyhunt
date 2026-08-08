/**
 * Queues 类型定义
 */
export type { Pagination } from '@/lib/types';
import type { Pagination } from '@/lib/types';

/** 队列名称 */
export type QueueName = 'scrape' | 'topic-run' | 'delivery-email' | 'delivery-webhook';

/** 队列任务状态 */
export type QueueJobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';

/** 单个队列状态 */
export interface QueueStats {
  name: QueueName;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

/** 所有队列状态 */
export interface AllQueueStats {
  queues: QueueStats[];
  summary: {
    totalWaiting: number;
    totalActive: number;
    totalFailed: number;
  };
}

/** 队列任务 */
export interface QueueJob {
  id: string;
  name: string;
  attemptsMade: number;
  maxAttempts: number;
  processedOn: string | null;
  finishedOn: string | null;
  timestamp: string;
  error: string | null;
}

/** 队列任务查询参数 */
export interface QueueJobsQuery {
  status?: QueueJobStatus;
  page?: number;
  limit?: number;
}

/** 队列任务列表响应 */
export interface QueueJobsResponse {
  items: QueueJob[];
  pagination: Pagination;
}

/** 操作结果 */
export interface QueueOperationResult {
  retried?: number;
  removed?: number;
  paused?: boolean;
  jobId?: string;
}
