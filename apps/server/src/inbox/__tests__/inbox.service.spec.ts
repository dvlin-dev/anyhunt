import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service';
import { InboxService } from '../inbox.service';

describe('InboxService', () => {
  it('queries RunItems through subscription time windows without an Inbox table', async () => {
    const prisma = {
      subscription: {
        findMany: vi.fn().mockResolvedValue([
          {
            topicId: 'topic-1',
            subscribedAt: new Date('2026-08-01T00:00:00.000Z'),
            canceledAt: new Date('2026-08-02T00:00:00.000Z'),
          },
          {
            topicId: 'topic-2',
            subscribedAt: new Date('2026-08-01T00:00:00.000Z'),
            canceledAt: null,
          },
        ]),
      },
      runItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'item-1',
            canonicalUrlHash: 'a'.repeat(64),
            run: { topic: { id: 'topic-1', title: 'Topic' } },
          },
        ]),
        count: vi.fn().mockResolvedValue(1),
      },
      userItemState: {
        findMany: vi.fn().mockResolvedValue([
          {
            canonicalUrlHash: 'a'.repeat(64),
            readAt: new Date('2026-08-01T01:00:00.000Z'),
            savedAt: null,
            notInterestedAt: null,
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new InboxService(prisma);

    const result = await service.list('user-1', { page: 1, limit: 20 });

    const where = vi.mocked(prisma.runItem.findMany).mock.calls[0]![0]!.where;
    expect(where?.OR).toEqual([
      {
        run: {
          topicId: 'topic-1',
          completedAt: {
            gte: new Date('2026-08-01T00:00:00.000Z'),
            lte: new Date('2026-08-02T00:00:00.000Z'),
          },
        },
      },
      {
        run: {
          topicId: 'topic-2',
          completedAt: { gte: new Date('2026-08-01T00:00:00.000Z') },
        },
      },
    ]);
    expect(result.items[0]).toMatchObject({
      state: { isRead: true, isSaved: false, isNotInterested: false },
    });
  });

  it('upserts personal state by userId + canonicalUrlHash only', async () => {
    const prisma = {
      subscription: {
        findMany: vi.fn().mockResolvedValue([
          {
            topicId: 'topic-1',
            subscribedAt: new Date('2026-08-01T00:00:00.000Z'),
            canceledAt: null,
          },
        ]),
      },
      runItem: { findFirst: vi.fn().mockResolvedValue({ id: 'item-1' }) },
      userItemState: {
        upsert: vi.fn().mockResolvedValue({
          readAt: null,
          savedAt: new Date('2026-08-01T01:00:00.000Z'),
          notInterestedAt: null,
        }),
      },
    } as unknown as PrismaService;
    const service = new InboxService(prisma);

    await service.updateState('user-1', 'a'.repeat(64), { isSaved: true });

    expect(prisma.userItemState.upsert).toHaveBeenCalledWith({
      where: {
        userId_canonicalUrlHash: {
          userId: 'user-1',
          canonicalUrlHash: 'a'.repeat(64),
        },
      },
      create: {
        userId: 'user-1',
        canonicalUrlHash: 'a'.repeat(64),
        savedAt: expect.any(Date),
      },
      update: { savedAt: expect.any(Date) },
    });
  });
});
