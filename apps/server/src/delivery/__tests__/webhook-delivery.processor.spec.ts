import { describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import type { DataSecretService } from '../../common/services/data-secret.service';
import {
  WebhookRequestError,
  type WebhookService,
} from '../../common/services/webhook.service';
import type { DeliveryService } from '../delivery.service';
import { WebhookDeliveryProcessor } from '../webhook-delivery.processor';

describe('WebhookDeliveryProcessor', () => {
  const attempt = {
    id: 'delivery-1',
    webhookUrl: 'https://hooks.example.com/anyhunt',
    webhookSecretEncrypted: 'v1:encrypted',
    payload: { runId: 'run-1', topic: { title: 'Research' }, items: [] },
  };

  it('leaves a transient failure pending and throws for BullMQ retry', async () => {
    const delivery = {
      claim: vi.fn().mockResolvedValue(attempt),
      markTransientFailure: vi.fn(),
      markDelivered: vi.fn(),
    };
    const webhook = {
      send: vi
        .fn()
        .mockRejectedValue(new WebhookRequestError('UPSTREAM_503', true)),
    };
    const secrets = { decrypt: vi.fn().mockReturnValue('plain-secret') };
    const processor = new WebhookDeliveryProcessor(
      delivery as unknown as DeliveryService,
      webhook as unknown as WebhookService,
      secrets as unknown as DataSecretService,
    );

    await expect(
      processor.process({
        data: { deliveryId: 'delivery-1' },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as Job<{ deliveryId: string }>),
    ).rejects.toThrow('UPSTREAM_503');
    expect(delivery.markTransientFailure).toHaveBeenCalledWith(
      'delivery-1',
      'UPSTREAM_503',
      false,
    );
    expect(delivery.markDelivered).not.toHaveBeenCalled();
  });

  it('marks permanent 4xx failures without retrying', async () => {
    const delivery = {
      claim: vi.fn().mockResolvedValue(attempt),
      markPermanentFailure: vi.fn(),
      markDelivered: vi.fn(),
    };
    const webhook = {
      send: vi
        .fn()
        .mockRejectedValue(new WebhookRequestError('UPSTREAM_410', false)),
    };
    const processor = new WebhookDeliveryProcessor(
      delivery as unknown as DeliveryService,
      webhook as unknown as WebhookService,
      { decrypt: vi.fn().mockReturnValue('plain-secret') } as unknown as DataSecretService,
    );

    await processor.process({
      data: { deliveryId: 'delivery-1' },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as Job<{ deliveryId: string }>);

    expect(delivery.markPermanentFailure).toHaveBeenCalledWith(
      'delivery-1',
      'UPSTREAM_410',
    );
    expect(delivery.markDelivered).not.toHaveBeenCalled();
  });
});
