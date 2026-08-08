import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { PublicTopicService } from '../public-topic.service';

describe('PublicTopicService permission matrix', () => {
  const topic = {
    id: 'topic-1',
    ownerId: 'owner-1',
    slug: 'research',
    title: 'Research',
    goal: 'Track updates',
    description: null,
    visibility: 'PRIVATE',
    status: 'ACTIVE',
    locale: 'en',
    cron: '0 8 * * *',
    timezone: 'UTC',
    lastRunAt: null,
    nextRunAt: null,
    _count: { subscriptions: 1 },
  };

  it.each([
    ['PRIVATE', null, false],
    ['PRIVATE', { id: 'owner-1', isAdmin: false }, true],
    ['UNLISTED', null, true],
    ['PUBLIC', null, true],
    ['PUBLIC', { id: 'reader-1', isAdmin: false }, true],
  ] as const)('%s visibility resolves correctly', async (visibility, viewer, allowed) => {
    const prisma = {
      topic: {
        findUnique: vi.fn().mockResolvedValue({ ...topic, visibility }),
      },
    } as unknown as PrismaService;
    const service = new PublicTopicService(prisma);
    const result = service.getBySlug('research', viewer);
    if (allowed) await expect(result).resolves.toMatchObject({ slug: 'research' });
    else await expect(result).rejects.toThrow(NotFoundException);
  });

  it('only lets the owner or an admin read a suspended Topic', async () => {
    const prisma = {
      topic: {
        findUnique: vi.fn().mockResolvedValue({
          ...topic,
          visibility: 'PUBLIC',
          status: 'SUSPENDED',
        }),
      },
    } as unknown as PrismaService;
    const service = new PublicTopicService(prisma);

    await expect(service.getBySlug('research', null)).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.getBySlug('research', { id: 'admin-1', isAdmin: true }),
    ).resolves.toMatchObject({ status: 'SUSPENDED' });
  });
});
