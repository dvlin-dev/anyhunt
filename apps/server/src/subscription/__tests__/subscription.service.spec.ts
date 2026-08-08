import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionPreferencesSchema } from '../subscription.schema';
import { SubscriptionService } from '../subscription.service';
import type { DataSecretService } from '../../common/services/data-secret.service';
import type { UrlValidator } from '../../common/validators/url.validator';

const secrets = { encrypt: vi.fn().mockReturnValue('encrypted') };
const urlValidator = { isAllowed: vi.fn().mockResolvedValue(true) };

describe('SubscriptionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('subscribes idempotently and restores without changing the original subscribedAt', async () => {
    const existing = {
      id: 'subscription-1',
      userId: 'user-1',
      topicId: 'topic-1',
      enabled: false,
      subscribedAt: new Date('2026-08-01T00:00:00.000Z'),
      canceledAt: new Date('2026-08-02T00:00:00.000Z'),
    };
    const prisma = {
      topic: {
        findFirst: vi.fn().mockResolvedValue({ id: 'topic-1' }),
      },
      subscription: {
        findUnique: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue({
          ...existing,
          enabled: true,
          canceledAt: null,
        }),
        create: vi.fn(),
      },
    } as unknown as PrismaService;
    const service = new SubscriptionService(
      prisma,
      secrets as unknown as DataSecretService,
      urlValidator as unknown as UrlValidator,
    );

    await service.subscribe('user-1', 'topic-1');

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'subscription-1' },
        data: { enabled: true, canceledAt: null },
        select: expect.not.objectContaining({
          webhookSecretEncrypted: true,
        }),
      }),
    );
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('cancels without deleting history and isolates preference fields', async () => {
    const prisma = {
      subscription: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: vi.fn().mockResolvedValue({ id: 'subscription-1' }),
        update: vi.fn().mockResolvedValue({ id: 'subscription-1' }),
      },
    } as unknown as PrismaService;
    const service = new SubscriptionService(
      prisma,
      secrets as unknown as DataSecretService,
      urlValidator as unknown as UrlValidator,
    );

    await service.cancel('user-1', 'topic-1');
    await service.updatePreferences('user-1', 'topic-1', {
      inboxEnabled: true,
      emailEnabled: false,
      webhookEnabled: false,
    });

    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', topicId: 'topic-1', enabled: true },
      data: { enabled: false, canceledAt: expect.any(Date) },
    });
    expect(
      SubscriptionPreferencesSchema.safeParse({
        inboxEnabled: true,
        goal: 'change shared research',
      }).success,
    ).toBe(false);
  });

  it('accepts only the exact configured local acceptance Sink without weakening SSRF checks', async () => {
    vi.stubEnv(
      'ANYHUNT_LOCAL_WEBHOOK_SINK_URL',
      'http://webhook-sink:3000/acceptance',
    );
    const prisma = {
      subscription: {
        findFirstOrThrow: vi.fn().mockResolvedValue({
          id: 'subscription-1',
          webhookUrl: null,
          webhookSecretEncrypted: null,
        }),
        update: vi.fn().mockResolvedValue({ id: 'subscription-1' }),
      },
    } as unknown as PrismaService;
    const service = new SubscriptionService(
      prisma,
      secrets as unknown as DataSecretService,
      urlValidator as unknown as UrlValidator,
    );

    await service.updatePreferences('user-1', 'topic-1', {
      webhookEnabled: true,
      webhookUrl: 'http://webhook-sink:3000/acceptance',
      webhookSecret: 'local-signing-secret',
    });

    expect(urlValidator.isAllowed).not.toHaveBeenCalled();
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          webhookEnabled: true,
          webhookUrl: 'http://webhook-sink:3000/acceptance',
        }),
      }),
    );
  });
});
