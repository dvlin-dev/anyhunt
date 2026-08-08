import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service';
import { AdminOperationsService } from '../admin-operations.service';

describe('AdminOperationsService', () => {
  it('returns provider diagnostics without selecting encrypted credentials', async () => {
    const prisma = {
      llmProvider: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    const service = new AdminOperationsService(prisma);

    await service.listProviders({ page: 1, limit: 20 });

    const select = vi.mocked(prisma.llmProvider.findMany).mock.calls[0]![0]!.select;
    expect(select).not.toHaveProperty('apiKeyEncrypted');
    expect(select).toMatchObject({ id: true, name: true, providerType: true });
  });

  it('returns Topic health and Subscription channels without webhook addresses', async () => {
    const prisma = {
      topic: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      subscription: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    } as unknown as PrismaService;
    const service = new AdminOperationsService(prisma);

    await service.listTopics({ page: 1, limit: 20 });
    await service.listSubscriptions({ page: 1, limit: 20 });

    const topicSelect = vi.mocked(prisma.topic.findMany).mock.calls[0]![0]!.select;
    expect(topicSelect).toMatchObject({
      owner: { select: { id: true, email: true, name: true } },
      managedSkill: {
        select: { id: true, name: true, enabled: true, currentVersion: true },
      },
    });

    const subscriptionSelect = vi.mocked(prisma.subscription.findMany).mock.calls[0]![0]!.select;
    expect(subscriptionSelect).not.toHaveProperty('webhookUrl');
    expect(subscriptionSelect).not.toHaveProperty('webhookSecretEncrypted');
    expect(subscriptionSelect).toMatchObject({
      inboxEnabled: true,
      emailEnabled: true,
      webhookEnabled: true,
    });
  });
});
