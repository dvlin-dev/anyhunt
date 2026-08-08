import { describe, expect, it, vi } from 'vitest';
import type { Queue } from 'bullmq';
import type { PrismaService } from '../../prisma/prisma.service';
import type { DataSecretService } from '../../common/services/data-secret.service';
import { DeliveryService } from '../delivery.service';

describe('email unsubscribe', () => {
  it('uses a verified, idempotent token and only disables email delivery', async () => {
    const prisma = {
      subscription: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;
    const secrets = {
      verifyToken: vi.fn().mockReturnValue('subscription-1'),
    };
    const service = new DeliveryService(
      prisma,
      {} as Queue,
      {} as Queue,
      secrets as unknown as DataSecretService,
    );

    await service.unsubscribeEmail('signed-token');
    await service.unsubscribeEmail('signed-token');

    expect(secrets.verifyToken).toHaveBeenCalledWith(
      'delivery-unsubscribe',
      'signed-token',
    );
    expect(prisma.subscription.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'subscription-1', emailEnabled: true },
      data: { emailEnabled: false },
    });
  });
});
