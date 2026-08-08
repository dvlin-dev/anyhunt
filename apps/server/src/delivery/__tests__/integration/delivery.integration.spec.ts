import { randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSecretService } from '../../../common/services/data-secret.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  EMAIL_DELIVERY_QUEUE,
  WEBHOOK_DELIVERY_QUEUE,
} from '../../../queue/queue.constants';
import { parseRedisUrl } from '../../../queue/queue.utils';
import { DeliveryService } from '../../delivery.service';

describe('Delivery idempotency integration', () => {
  let prisma: PrismaService;
  let emailQueue: Queue;
  let webhookQueue: Queue;
  const ownedUserIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const connection = {
      ...parseRedisUrl(process.env.REDIS_URL!),
      maxRetriesPerRequest: null,
    };
    emailQueue = new Queue(EMAIL_DELIVERY_QUEUE, { connection });
    webhookQueue = new Queue(WEBHOOK_DELIVERY_QUEUE, { connection });
    await Promise.all([
      emailQueue.obliterate({ force: true }).catch(() => undefined),
      webhookQueue.obliterate({ force: true }).catch(() => undefined),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      emailQueue.obliterate({ force: true }).catch(() => undefined),
      webhookQueue.obliterate({ force: true }).catch(() => undefined),
    ]);
    await Promise.all([emailQueue.close(), webhookQueue.close()]);
    if (ownedUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: ownedUserIds } } });
    }
    await prisma.$disconnect();
  });

  it('deduplicates concurrent enqueue and permits one concurrent claim', async () => {
    const suffix = randomUUID();
    const ownerId = `owner-${suffix}`;
    const followerId = `follower-${suffix}`;
    const topicId = `topic-${suffix}`;
    const runId = `run-${suffix}`;
    ownedUserIds.push(ownerId, followerId);
    await prisma.user.createMany({
      data: [
        {
          id: ownerId,
          email: `owner-${suffix}@example.com`,
          emailVerified: true,
        },
        {
          id: followerId,
          email: `follower-${suffix}@example.com`,
          emailVerified: true,
        },
      ],
    });
    await prisma.topic.create({
      data: {
        id: topicId,
        ownerId,
        slug: `delivery-${suffix}`,
        title: 'Delivery',
        goal: 'Deliver one result.',
        cron: '0 * * * *',
        timezone: 'UTC',
      },
    });
    const subscribedAt = new Date(Date.now() - 60_000);
    await prisma.subscription.createMany({
      data: [
        {
          userId: ownerId,
          topicId,
          subscribedAt,
          emailEnabled: true,
        },
        {
          userId: followerId,
          topicId,
          subscribedAt,
          emailEnabled: true,
        },
      ],
    });
    const completedAt = new Date();
    await prisma.run.create({
      data: {
        id: runId,
        topicId,
        runKey: `${topicId}:MANUAL:delivery`,
        trigger: 'MANUAL',
        status: 'SUCCEEDED',
        scheduledAt: completedAt,
        startedAt: completedAt,
        completedAt,
        narrative: 'One update.',
        items: {
          create: {
            canonicalUrlHash: 'c'.repeat(64),
            title: 'Update',
            url: 'https://example.com/update',
            summary: 'Summary.',
            selectionReason: 'Relevant.',
            rank: 1,
            retrievedAt: completedAt,
            contentHash: 'd'.repeat(64),
          },
        },
      },
    });
    const service = new DeliveryService(
      prisma,
      emailQueue,
      webhookQueue,
      new DataSecretService(),
    );

    await Promise.all([
      service.enqueueForRun(runId),
      service.enqueueForRun(runId),
      service.enqueueForRun(runId),
    ]);
    const deliveries = await prisma.delivery.findMany({
      where: { runId },
      orderBy: { id: 'asc' },
    });
    expect(deliveries).toHaveLength(2);
    expect(await emailQueue.getJobCounts('waiting')).toMatchObject({
      waiting: 2,
    });

    const claims = await Promise.all([
      service.claim(deliveries[0]!.id, 'EMAIL'),
      service.claim(deliveries[0]!.id, 'EMAIL'),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(
      await prisma.delivery.findUniqueOrThrow({
        where: { id: deliveries[0]!.id },
      }),
    ).toMatchObject({ status: 'PENDING', attemptCount: 1 });

    await service.enqueueForRun(runId);
    expect(await prisma.delivery.count({ where: { runId } })).toBe(2);
    expect(await emailQueue.getJobCounts('waiting')).toMatchObject({
      waiting: 2,
    });
  });
});
