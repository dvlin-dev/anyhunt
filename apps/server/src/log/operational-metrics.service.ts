/**
 * [INPUT]: Required BullMQ queues and a scheduled collection tick
 * [OUTPUT]: Structured queue-depth metric log
 * [POS]: Minimal production metric source for queue pressure
 */

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import {
  EMAIL_DELIVERY_QUEUE,
  SCRAPE_QUEUE,
  TOPIC_RUN_QUEUE,
  WEBHOOK_DELIVERY_QUEUE,
} from '../queue/queue.constants';

const METRICS_INTERVAL_MS = 60_000;

@Injectable()
export class OperationalMetricsService {
  private readonly logger = new Logger(OperationalMetricsService.name);

  constructor(
    @InjectQueue(SCRAPE_QUEUE) private readonly scrapeQueue: Queue,
    @InjectQueue(TOPIC_RUN_QUEUE) private readonly topicRunQueue: Queue,
    @InjectQueue(EMAIL_DELIVERY_QUEUE) private readonly emailQueue: Queue,
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE) private readonly webhookQueue: Queue,
  ) {}

  @Interval(METRICS_INTERVAL_MS)
  async logQueueDepths(): Promise<Record<string, number>> {
    const entries = await Promise.all(
      [
        [SCRAPE_QUEUE, this.scrapeQueue],
        [TOPIC_RUN_QUEUE, this.topicRunQueue],
        [EMAIL_DELIVERY_QUEUE, this.emailQueue],
        [WEBHOOK_DELIVERY_QUEUE, this.webhookQueue],
      ].map(async ([name, queue]) => {
        const counts = await (queue as Queue).getJobCounts(
          'waiting',
          'active',
          'delayed',
          'failed',
        );
        return [
          name as string,
          Object.values(counts).reduce((sum, count) => sum + count, 0),
        ] as const;
      }),
    );
    const queueDepths = Object.fromEntries(entries);
    this.logger.log(
      JSON.stringify({ event: 'queue_depth', queues: queueDepths }),
    );
    return queueDepths;
  }
}
