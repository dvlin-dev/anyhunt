import { describe, expect, it, vi } from 'vitest';
import type { Queue } from 'bullmq';
import type { PrismaService } from '../../prisma/prisma.service';
import type { DataSecretService } from '../../common/services/data-secret.service';
import { DeliveryService } from '../delivery.service';

describe('DeliveryService', () => {
  it('creates one durable Delivery per enabled channel and reuses stable job ids', async () => {
    const completedAt = new Date('2026-08-03T01:00:00.000Z');
    const prisma = {
      run: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'run-1',
          completedAt,
          topic: {
            status: 'ACTIVE',
            subscriptions: [
              {
                id: 'subscription-1',
                subscribedAt: new Date('2026-08-01T00:00:00.000Z'),
                canceledAt: null,
                emailEnabled: true,
                webhookEnabled: true,
                webhookUrl: 'https://hooks.example.com/anyhunt',
                webhookSecretEncrypted: 'v1:encrypted',
                user: { email: 'verified@example.com', emailVerified: true },
              },
            ],
          },
        }),
      },
      delivery: {
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
        findMany: vi.fn().mockResolvedValue([
          { id: 'delivery-email', channel: 'EMAIL' },
          { id: 'delivery-webhook', channel: 'WEBHOOK' },
        ]),
      },
    } as unknown as PrismaService;
    const emailQueue = { add: vi.fn() } as unknown as Queue;
    const webhookQueue = { add: vi.fn() } as unknown as Queue;
    const service = new DeliveryService(
      prisma,
      emailQueue,
      webhookQueue,
      {} as DataSecretService,
    );

    await service.enqueueForRun('run-1');

    expect(prisma.delivery.createMany).toHaveBeenCalledWith({
      data: [
        {
          runId: 'run-1',
          subscriptionId: 'subscription-1',
          channel: 'EMAIL',
        },
        {
          runId: 'run-1',
          subscriptionId: 'subscription-1',
          channel: 'WEBHOOK',
        },
      ],
      skipDuplicates: true,
    });
    expect(emailQueue.add).toHaveBeenCalledWith(
      'deliver',
      { deliveryId: 'delivery-email' },
      expect.objectContaining({ jobId: 'delivery-email' }),
    );
    expect(webhookQueue.add).toHaveBeenCalledWith(
      'deliver',
      { deliveryId: 'delivery-webhook' },
      expect.objectContaining({ jobId: 'delivery-webhook' }),
    );
  });

  it('atomically refuses duplicate workers and delivery after cancellation', async () => {
    const prisma = {
      delivery: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'delivery-1',
          status: 'PENDING',
          channel: 'WEBHOOK',
          attemptCount: 0,
          run: { status: 'SUCCEEDED', topic: { status: 'ACTIVE' } },
          subscription: {
            enabled: false,
            canceledAt: new Date(),
            webhookEnabled: true,
          },
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;
    const service = new DeliveryService(
      prisma,
      {} as Queue,
      {} as Queue,
      {} as DataSecretService,
    );

    await expect(service.claim('delivery-1', 'WEBHOOK')).resolves.toBeNull();
    expect(prisma.delivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'delivery-1', status: 'PENDING' }),
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });
});
