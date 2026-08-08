/**
 * [INPUT]: Owner-scoped Topic commands and idempotent Run keys
 * [OUTPUT]: Transactional Topic, Owner Subscription, and Run persistence
 * [POS]: The only Prisma access layer for Topic and shared Run commands
 */

import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '../../generated/prisma-main/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTopicDto, UpdateTopicDto } from './topic.schema';
import { calculateNextRunAt } from './topic.schema';

export interface CompleteTopicRunInput {
  runId: string;
  status: 'SUCCEEDED' | 'EMPTY';
  narrative?: string;
  emptyReason?: string;
  runtimeStats: Prisma.InputJsonValue;
  items: Array<{
    canonicalUrlHash: string;
    title: string;
    url: string;
    summary: string;
    selectionReason: string;
    rank: number;
    retrievedAt: Date;
    sourceTitle: string | null;
    contentHash: string;
  }>;
}

function slugFor(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${base || 'topic'}-${createId().slice(0, 8)}`;
}

function manualRunKey(topicId: string, idempotencyKey: string): string {
  const hash = createHash('sha256').update(idempotencyKey).digest('hex');
  return `${topicId}:MANUAL:${hash}`;
}

export function scheduledRunKey(topicId: string, scheduledAt: Date): string {
  return `${topicId}:SCHEDULED:${scheduledAt.toISOString()}`;
}

@Injectable()
export class TopicRepositoryService {
  constructor(private readonly prisma: PrismaService) {}

  listOwned(ownerId: string) {
    return this.prisma.topic.findMany({
      where: { ownerId },
      include: {
        _count: { select: { subscriptions: true, runs: true } },
        managedSkill: {
          select: { id: true, name: true, currentVersion: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
  }

  async getOwned(ownerId: string, topicId: string) {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, ownerId },
      include: {
        attachedSkills: {
          where: { enabled: true, archivedAt: null },
          select: { id: true, name: true, currentVersion: true },
          orderBy: { name: 'asc' },
        },
        managedSkill: {
          select: { id: true, name: true, currentVersion: true },
        },
      },
    });
    if (!topic) throw new NotFoundException('Topic not found');
    return topic;
  }

  listRuns(ownerId: string, topicId: string) {
    return this.prisma.run.findMany({
      where: { topicId, topic: { ownerId } },
      select: {
        id: true,
        status: true,
        trigger: true,
        scheduledAt: true,
        startedAt: true,
        completedAt: true,
        cancelRequestedAt: true,
        canceledAt: true,
        runtimeStats: true,
        narrative: true,
        emptyReason: true,
        errorCode: true,
        errorMessage: true,
        _count: { select: { items: true } },
      },
      orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
  }

  async getOwnedRun(ownerId: string, topicId: string, runId: string) {
    const run = await this.prisma.run.findFirst({
      where: { id: runId, topicId, topic: { ownerId } },
      select: {
        id: true,
        status: true,
        trigger: true,
        scheduledAt: true,
        startedAt: true,
        completedAt: true,
        cancelRequestedAt: true,
        canceledAt: true,
        runtimeStats: true,
        narrative: true,
        emptyReason: true,
        errorCode: true,
        errorMessage: true,
        items: {
          select: {
            canonicalUrlHash: true,
            title: true,
            url: true,
            summary: true,
            selectionReason: true,
            rank: true,
            retrievedAt: true,
            sourceTitle: true,
          },
          orderBy: [{ rank: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!run) throw new NotFoundException('Run not found');
    return run;
  }

  createOwned(input: CreateTopicDto & { ownerId: string }) {
    const now = new Date();
    return this.prisma.$transaction(async (transaction) => {
      const topic = await transaction.topic.create({
        data: {
          ownerId: input.ownerId,
          slug: slugFor(input.title),
          title: input.title,
          goal: input.goal,
          cron: input.cron,
          timezone: input.timezone,
          locale: input.locale,
          nextRunAt: calculateNextRunAt(input.cron, input.timezone, now),
        },
      });
      await transaction.subscription.create({
        data: {
          userId: input.ownerId,
          topicId: topic.id,
          inboxEnabled: true,
        },
      });
      const initialRun = await transaction.run.create({
        data: {
          topicId: topic.id,
          runKey: `${topic.id}:INITIAL`,
          trigger: 'INITIAL',
          scheduledAt: now,
        },
      });
      return { topic, initialRun };
    });
  }

  async updateOwned(ownerId: string, topicId: string, input: UpdateTopicDto) {
    const current = await this.getOwned(ownerId, topicId);
    const cron = input.cron ?? current.cron;
    const timezone = input.timezone ?? current.timezone;
    return this.prisma.topic.update({
      where: { id: current.id },
      data: {
        ...input,
        ...((input.cron || input.timezone) && current.enabled
          ? { nextRunAt: calculateNextRunAt(cron, timezone) }
          : {}),
      },
    });
  }

  async setEnabled(
    ownerId: string,
    topicId: string,
    enabled: boolean,
    nextRunAt: Date | null,
  ) {
    const topic = await this.getOwned(ownerId, topicId);
    return this.prisma.topic.update({
      where: { id: topic.id },
      data: { enabled, nextRunAt },
    });
  }

  async setVisibility(
    ownerId: string,
    topicId: string,
    visibility: 'PRIVATE' | 'UNLISTED' | 'PUBLIC',
  ) {
    const topic = await this.getOwned(ownerId, topicId);
    return this.prisma.topic.update({
      where: { id: topic.id },
      data: { visibility },
    });
  }

  async createManualRun(
    ownerId: string,
    topicId: string,
    idempotencyKey: string,
  ) {
    const topic = await this.getOwned(ownerId, topicId);
    if (topic.status !== 'ACTIVE') {
      throw new BadRequestException('Suspended Topic cannot run');
    }
    const runKey = manualRunKey(topic.id, idempotencyKey);
    return this.createRunIdempotently({
      topicId: topic.id,
      runKey,
      trigger: 'MANUAL',
      scheduledAt: new Date(),
    });
  }

  async createScheduledRun(topicId: string, scheduledAt: Date) {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, enabled: true, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!topic) throw new NotFoundException('Runnable Topic not found');
    return this.createRunIdempotently({
      topicId: topic.id,
      runKey: scheduledRunKey(topic.id, scheduledAt),
      trigger: 'SCHEDULED',
      scheduledAt,
    });
  }

  async claimDueRuns(now: Date, limit = 100) {
    const due = await this.prisma.topic.findMany({
      where: {
        enabled: true,
        status: 'ACTIVE',
        nextRunAt: { lte: now },
      },
      select: {
        id: true,
        cron: true,
        timezone: true,
        nextRunAt: true,
      },
      orderBy: [{ nextRunAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    const runs = [];
    for (const topic of due) {
      if (!topic.nextRunAt) continue;
      const scheduledAt = topic.nextRunAt;
      const run = await this.prisma.$transaction(async (transaction) => {
        const claimed = await transaction.topic.updateMany({
          where: {
            id: topic.id,
            enabled: true,
            status: 'ACTIVE',
            nextRunAt: scheduledAt,
          },
          data: {
            nextRunAt: calculateNextRunAt(
              topic.cron,
              topic.timezone,
              scheduledAt,
            ),
          },
        });
        if (claimed.count === 0) return null;
        return transaction.run.upsert({
          where: { runKey: scheduledRunKey(topic.id, scheduledAt) },
          create: {
            topicId: topic.id,
            runKey: scheduledRunKey(topic.id, scheduledAt),
            trigger: 'SCHEDULED',
            scheduledAt,
          },
          update: {},
          select: { id: true },
        });
      });
      if (run) runs.push(run);
    }
    return runs;
  }

  listQueuedRunIds(limit = 500) {
    return this.prisma.run.findMany({
      where: { status: 'QUEUED' },
      select: { id: true },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
  }

  async getRunForExecution(runId: string) {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: { topic: true },
    });
    if (!run) throw new NotFoundException('Run not found');
    return run;
  }

  async markRunCanceled(runId: string, reason: string) {
    return this.prisma.run.update({
      where: { id: runId },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        errorCode: 'TOPIC_NOT_RUNNABLE',
        errorMessage: reason,
      },
    });
  }

  async completeRun(input: CompleteTopicRunInput) {
    return this.prisma.$transaction(async (transaction) => {
      const run = await transaction.run.findUnique({
        where: { id: input.runId },
        select: { id: true, topicId: true, status: true },
      });
      if (!run) throw new NotFoundException('Run not found');
      if (run.status === 'SUCCEEDED' || run.status === 'EMPTY') return run;
      if (run.status !== 'RUNNING') {
        throw new BadRequestException('Run is not active');
      }
      if (input.items.length > 0) {
        await transaction.runItem.createMany({
          data: input.items.map((item) => ({ ...item, runId: run.id })),
          skipDuplicates: true,
        });
      }
      const completedAt = new Date();
      const completed = await transaction.run.update({
        where: { id: run.id },
        data: {
          status: input.status,
          completedAt,
          narrative: input.narrative ?? null,
          emptyReason: input.emptyReason ?? null,
          runtimeStats: input.runtimeStats,
          errorCode: null,
          errorMessage: null,
        },
      });
      await transaction.topic.update({
        where: { id: run.topicId },
        data: { lastRunAt: completedAt },
      });
      return completed;
    });
  }

  private async createRunIdempotently(input: {
    topicId: string;
    runKey: string;
    trigger: 'MANUAL' | 'SCHEDULED';
    scheduledAt: Date;
  }) {
    const existing = await this.prisma.run.findUnique({
      where: { runKey: input.runKey },
    });
    if (existing) return { run: existing, created: false as const };
    try {
      const run = await this.prisma.run.create({
        data: input,
      });
      return { run, created: true as const };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const concurrent = await this.prisma.run.findUnique({
          where: { runKey: input.runKey },
        });
        if (concurrent) return { run: concurrent, created: false as const };
      }
      throw error;
    }
  }

  async cancelOwnedRun(ownerId: string, topicId: string, runId: string) {
    const result = await this.prisma.run.updateMany({
      where: {
        id: runId,
        topicId,
        topic: { ownerId },
        status: { in: ['QUEUED', 'RUNNING'] },
        cancelRequestedAt: null,
      },
      data: { cancelRequestedAt: new Date() },
    });
    if (result.count === 0)
      throw new NotFoundException('Cancelable Run not found');
    return this.prisma.run.findUniqueOrThrow({ where: { id: runId } });
  }

  async forkPublic(ownerId: string, slug: string) {
    const source = await this.prisma.topic.findFirst({
      where: { slug, visibility: 'PUBLIC', status: 'ACTIVE' },
      select: {
        title: true,
        goal: true,
        cron: true,
        timezone: true,
        locale: true,
      },
    });
    if (!source) throw new NotFoundException('Public Topic not found');
    return this.createOwned({ ownerId, ...source });
  }
}
