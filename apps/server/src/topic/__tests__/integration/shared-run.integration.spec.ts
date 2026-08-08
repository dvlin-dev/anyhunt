import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InboxService } from '../../../inbox/inbox.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  scheduledRunKey,
  TopicRepositoryService,
} from '../../topic.repository.service';

describe('shared Topic Run integration', () => {
  let prisma: PrismaService;
  const ownedUserIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    if (ownedUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: ownedUserIds } } });
    }
    await prisma.$disconnect();
  });

  it('creates one scheduled Run for two subscribers and isolates personal state', async () => {
    const suffix = randomUUID();
    const ownerId = `owner-${suffix}`;
    const followerId = `follower-${suffix}`;
    const topicId = `topic-${suffix}`;
    ownedUserIds.push(ownerId, followerId);
    await prisma.user.createMany({
      data: [
        { id: ownerId, email: `owner-${suffix}@example.com` },
        { id: followerId, email: `follower-${suffix}@example.com` },
      ],
    });
    await prisma.topic.create({
      data: {
        id: topicId,
        ownerId,
        slug: `shared-${suffix}`,
        title: 'Shared research',
        goal: 'Track one current update.',
        cron: '0 * * * *',
        timezone: 'UTC',
      },
    });
    const subscribedAt = new Date(Date.now() - 60_000);
    await prisma.subscription.createMany({
      data: [
        { userId: ownerId, topicId, subscribedAt },
        { userId: followerId, topicId, subscribedAt },
      ],
    });

    const occurrence = new Date('2026-08-03T01:00:00.000Z');
    const repository = new TopicRepositoryService(prisma);
    const attempts = await Promise.all(
      Array.from({ length: 12 }, () =>
        repository.createScheduledRun(topicId, occurrence),
      ),
    );
    const runIds = new Set(attempts.map((attempt) => attempt.run.id));
    expect(runIds.size).toBe(1);
    expect(attempts.filter((attempt) => attempt.created)).toHaveLength(1);
    expect(
      await prisma.run.count({
        where: { runKey: scheduledRunKey(topicId, occurrence) },
      }),
    ).toBe(1);
    expect(await prisma.subscription.count({ where: { topicId } })).toBe(2);

    const runId = attempts[0]!.run.id;
    const completedAt = new Date();
    const canonicalUrlHash = 'a'.repeat(64);
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: 'SUCCEEDED',
        startedAt: completedAt,
        completedAt,
        narrative: 'One shared result.',
      },
    });
    await prisma.runItem.create({
      data: {
        runId,
        canonicalUrlHash,
        title: 'Update',
        url: 'https://example.com/update',
        summary: 'Summary.',
        selectionReason: 'Relevant.',
        rank: 1,
        retrievedAt: completedAt,
        contentHash: 'b'.repeat(64),
      },
    });

    const inbox = new InboxService(prisma);
    await Promise.all([
      inbox.updateState(ownerId, canonicalUrlHash, { isRead: true }),
      inbox.updateState(followerId, canonicalUrlHash, { isSaved: true }),
    ]);
    const states = await prisma.userItemState.findMany({
      where: { canonicalUrlHash },
      orderBy: { userId: 'asc' },
    });
    expect(states).toHaveLength(2);
    expect(states.find((state) => state.userId === ownerId)).toMatchObject({
      readAt: expect.any(Date),
      savedAt: null,
    });
    expect(states.find((state) => state.userId === followerId)).toMatchObject({
      readAt: null,
      savedAt: expect.any(Date),
    });
    expect(await prisma.runItem.count({ where: { runId } })).toBe(1);
  });
});
