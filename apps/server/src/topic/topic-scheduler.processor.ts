/**
 * [INPUT]: Due Topic rows and queued Run reconciliation
 * [OUTPUT]: Idempotent BullMQ jobs keyed by Run ID
 * [POS]: Thin schedule scanner; database Run rows remain authoritative
 */

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import { TOPIC_RUN_QUEUE } from '../queue/queue.constants';
import { TopicRepositoryService } from './topic.repository.service';

@Injectable()
export class TopicSchedulerProcessor {
  constructor(
    private readonly repository: TopicRepositoryService,
    @InjectQueue(TOPIC_RUN_QUEUE) private readonly runQueue: Queue,
  ) {}

  @Interval(60_000)
  async scheduleDueTopics(): Promise<void> {
    const [queued, scheduled] = await Promise.all([
      this.repository.listQueuedRunIds(),
      this.repository.claimDueRuns(new Date()),
    ]);
    const runIds = new Set([
      ...queued.map((run) => run.id),
      ...scheduled.map((run) => run.id),
    ]);
    for (const runId of runIds) {
      await this.runQueue.add(
        'run',
        { runId },
        { jobId: runId, removeOnComplete: 100, removeOnFail: 500 },
      );
    }
  }
}
