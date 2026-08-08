import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  scheduledRunKey,
  TopicRepositoryService,
} from '../topic.repository.service';

describe('TopicRepositoryService shared Run', () => {
  it('derives the scheduled Run key only from Topic and occurrence', () => {
    expect(
      scheduledRunKey('topic-1', new Date('2026-08-03T09:00:00.000Z')),
    ).toBe('topic-1:SCHEDULED:2026-08-03T09:00:00.000Z');
  });

  it('creates one shared scheduled Run without reading subscriber count', async () => {
    const scheduledAt = new Date('2026-08-03T09:00:00.000Z');
    const prisma = {
      topic: {
        findFirst: vi.fn().mockResolvedValue({ id: 'topic-1' }),
      },
      run: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'run-1',
          topicId: 'topic-1',
          trigger: 'SCHEDULED',
          scheduledAt,
        }),
      },
      subscription: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
    } as unknown as PrismaService;
    const repository = new TopicRepositoryService(prisma);

    const result = await repository.createScheduledRun('topic-1', scheduledAt);

    expect(result).toMatchObject({ created: true, run: { id: 'run-1' } });
    expect(prisma.run.create).toHaveBeenCalledWith({
      data: {
        topicId: 'topic-1',
        runKey: 'topic-1:SCHEDULED:2026-08-03T09:00:00.000Z',
        trigger: 'SCHEDULED',
        scheduledAt,
      },
    });
    expect(prisma.subscription.count).not.toHaveBeenCalled();
    expect(prisma.subscription.findMany).not.toHaveBeenCalled();
  });

  it('returns the existing Run for a repeated schedule occurrence', async () => {
    const scheduledAt = new Date('2026-08-03T09:00:00.000Z');
    const existing = { id: 'run-existing', topicId: 'topic-1' };
    const prisma = {
      topic: { findFirst: vi.fn().mockResolvedValue({ id: 'topic-1' }) },
      run: {
        findUnique: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
      },
    } as unknown as PrismaService;

    const result = await new TopicRepositoryService(
      prisma,
    ).createScheduledRun('topic-1', scheduledAt);

    expect(result).toEqual({ run: existing, created: false });
    expect(prisma.run.create).not.toHaveBeenCalled();
  });

  it('forks only public Topic metadata into a fresh private execution', async () => {
    const prisma = {
      topic: {
        findFirst: vi.fn().mockResolvedValue({
          title: 'Public research',
          goal: 'Track public updates.',
          cron: '0 9 * * *',
          timezone: 'UTC',
          locale: 'en',
        }),
      },
    } as unknown as PrismaService;
    const repository = new TopicRepositoryService(prisma);
    const createOwned = vi.spyOn(repository, 'createOwned').mockResolvedValue({
      topic: { id: 'fork-1' },
      initialRun: { id: 'run-fork' },
    } as never);

    await repository.forkPublic('user-2', 'public-research');

    expect(prisma.topic.findFirst).toHaveBeenCalledWith({
      where: {
        slug: 'public-research',
        visibility: 'PUBLIC',
        status: 'ACTIVE',
      },
      select: {
        title: true,
        goal: true,
        cron: true,
        timezone: true,
        locale: true,
      },
    });
    expect(createOwned).toHaveBeenCalledWith({
      ownerId: 'user-2',
      title: 'Public research',
      goal: 'Track public updates.',
      cron: '0 9 * * *',
      timezone: 'UTC',
      locale: 'en',
    });
  });

  it('does not fork private or unavailable Topics', async () => {
    const prisma = {
      topic: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    await expect(
      new TopicRepositoryService(prisma).forkPublic('user-2', 'private-topic'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
