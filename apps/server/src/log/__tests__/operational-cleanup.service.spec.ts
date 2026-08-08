import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../generated/prisma-main/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { OperationalCleanupService } from '../operational-cleanup.service';

describe('OperationalCleanupService', () => {
  it('clears only expired failed checkpoints and terminal operational records', async () => {
    const prisma = {
      run: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
      idempotencyRecord: {
        deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
      },
      delivery: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
    } as unknown as PrismaService;
    const now = new Date('2026-08-03T00:00:00.000Z');

    await expect(
      new OperationalCleanupService(prisma).cleanup(now),
    ).resolves.toEqual({
      checkpoints: 2,
      idempotencyRecords: 3,
      deliveries: 4,
    });
    expect((prisma as any).run.updateMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['FAILED', 'CANCELED'] },
        checkpoint: { not: Prisma.DbNull },
        updatedAt: { lt: new Date('2026-07-27T00:00:00.000Z') },
      },
      data: { checkpoint: Prisma.DbNull },
    });
    expect((prisma as any).idempotencyRecord.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: now } },
    });
    expect((prisma as any).delivery.deleteMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['DELIVERED', 'FAILED'] },
        updatedAt: { lt: new Date('2026-07-04T00:00:00.000Z') },
      },
    });
  });
});
