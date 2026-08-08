import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service';
import { TopicReportService } from '../topic-report.service';

describe('TopicReportService', () => {
  it('updates the single report for the same user and Topic', async () => {
    const prisma = {
      topic: { findFirst: vi.fn().mockResolvedValue({ id: 'topic-1' }) },
      topicReport: { upsert: vi.fn().mockResolvedValue({ id: 'report-1' }) },
    } as unknown as PrismaService;
    const service = new TopicReportService(prisma);

    await service.report('user-1', 'topic-1', {
      reason: 'MISLEADING',
      description: 'The primary source does not support this claim.',
    });

    expect(prisma.topicReport.upsert).toHaveBeenCalledWith({
      where: {
        topicId_reporterUserId: { topicId: 'topic-1', reporterUserId: 'user-1' },
      },
      create: expect.objectContaining({
        topicId: 'topic-1',
        reporterUserId: 'user-1',
        reason: 'MISLEADING',
      }),
      update: expect.objectContaining({
        reason: 'MISLEADING',
        status: 'PENDING',
        resolvedAt: null,
      }),
    });
  });

  it('suspends a Topic and records the admin actor and reason atomically', async () => {
    const transaction = {
      topic: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'topic-1',
          ownerId: 'owner-1',
          status: 'ACTIVE',
          enabled: true,
          cron: '0 8 * * *',
          timezone: 'UTC',
        }),
        update: vi.fn().mockResolvedValue({ id: 'topic-1', status: 'SUSPENDED' }),
      },
      adminAuditLog: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn((callback) => callback(transaction)),
    } as unknown as PrismaService;
    const service = new TopicReportService(prisma);

    await service.setTopicStatus(
      'admin-1',
      'topic-1',
      'SUSPENDED',
      'Confirmed policy violation',
    );

    expect(transaction.topic.update).toHaveBeenCalledWith({
      where: { id: 'topic-1' },
      data: { status: 'SUSPENDED' },
    });
    expect(transaction.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'admin-1',
        targetUserId: 'owner-1',
        action: 'TOPIC_SUSPEND',
        reason: 'Confirmed policy violation',
      }),
    });
  });
});
