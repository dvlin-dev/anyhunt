/**
 * [INPUT]: Authenticated Topic commands
 * [OUTPUT]: Owner-scoped Topic mutations and idempotent Run queueing
 * [POS]: Topic application service; contains no Agent or Delivery implementation
 */

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { TOPIC_RUN_QUEUE } from '../queue/queue.constants';
import type { CreateTopicDto, UpdateTopicDto } from './topic.schema';
import { calculateNextRunAt } from './topic.schema';
import { TopicRepositoryService } from './topic.repository.service';

@Injectable()
export class TopicService {
  constructor(
    private readonly repository: TopicRepositoryService,
    @InjectQueue(TOPIC_RUN_QUEUE) private readonly runQueue: Queue,
  ) {}

  list(ownerId: string) {
    return this.repository.listOwned(ownerId);
  }

  get(ownerId: string, topicId: string) {
    return this.repository.getOwned(ownerId, topicId);
  }

  listRuns(ownerId: string, topicId: string) {
    return this.repository.listRuns(ownerId, topicId);
  }

  getRun(ownerId: string, topicId: string, runId: string) {
    return this.repository.getOwnedRun(ownerId, topicId, runId);
  }

  async create(ownerId: string, input: CreateTopicDto) {
    const result = await this.repository.createOwned({ ownerId, ...input });
    await this.enqueue(result.initialRun.id);
    return result;
  }

  update(ownerId: string, topicId: string, input: UpdateTopicDto) {
    return this.repository.updateOwned(ownerId, topicId, input);
  }

  pause(ownerId: string, topicId: string) {
    return this.repository.setEnabled(ownerId, topicId, false, null);
  }

  async resume(ownerId: string, topicId: string) {
    const topic = await this.repository.getOwned(ownerId, topicId);
    return this.repository.setEnabled(
      ownerId,
      topicId,
      true,
      calculateNextRunAt(topic.cron, topic.timezone),
    );
  }

  setVisibility(
    ownerId: string,
    topicId: string,
    visibility: 'PRIVATE' | 'UNLISTED' | 'PUBLIC',
  ) {
    return this.repository.setVisibility(ownerId, topicId, visibility);
  }

  async triggerManual(
    ownerId: string,
    topicId: string,
    idempotencyKey: string,
  ) {
    const result = await this.repository.createManualRun(
      ownerId,
      topicId,
      idempotencyKey,
    );
    if (result.created) await this.enqueue(result.run.id);
    return result.run;
  }

  cancelRun(ownerId: string, topicId: string, runId: string) {
    return this.repository.cancelOwnedRun(ownerId, topicId, runId);
  }

  async fork(ownerId: string, slug: string) {
    const result = await this.repository.forkPublic(ownerId, slug);
    await this.enqueue(result.initialRun.id);
    return result;
  }

  private enqueue(runId: string) {
    return this.runQueue.add(
      'run',
      { runId },
      {
        jobId: runId,
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }
}
