/**
 * [INPUT]: WEBHOOK Delivery queue job
 * [OUTPUT]: One signed SSRF-safe webhook and durable terminal/retry state
 * [POS]: Webhook channel adapter
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { DataSecretService } from '../common/services/data-secret.service';
import {
  WebhookRequestError,
  WebhookService,
} from '../common/services/webhook.service';
import { WEBHOOK_DELIVERY_QUEUE } from '../queue/queue.constants';
import { DeliveryService } from './delivery.service';

@Processor(WEBHOOK_DELIVERY_QUEUE, { concurrency: 5 })
export class WebhookDeliveryProcessor extends WorkerHost {
  constructor(
    private readonly deliveries: DeliveryService,
    private readonly webhook: WebhookService,
    private readonly secrets: DataSecretService,
  ) {
    super();
  }

  async process(job: Job<{ deliveryId: string }>): Promise<void> {
    const attempt = await this.deliveries.claim(job.data.deliveryId, 'WEBHOOK');
    if (!attempt?.webhookUrl || !attempt.webhookSecretEncrypted) return;

    let secret: string;
    try {
      secret = this.secrets.decrypt(
        'subscription-webhook',
        attempt.webhookSecretEncrypted,
      );
    } catch {
      await this.deliveries.markPermanentFailure(
        attempt.id,
        'WEBHOOK_SECRET_INVALID',
      );
      return;
    }

    try {
      await this.webhook.send(
        attempt.webhookUrl,
        { event: 'topic.run.completed', data: attempt.payload },
        secret,
        attempt.id,
      );
      await this.deliveries.markDelivered(attempt.id);
    } catch (error) {
      const requestError =
        error instanceof WebhookRequestError
          ? error
          : new WebhookRequestError('WEBHOOK_NETWORK_ERROR', true);
      if (!requestError.retryable) {
        await this.deliveries.markPermanentFailure(
          attempt.id,
          requestError.code,
        );
        return;
      }
      const finalAttempt =
        job.attemptsMade + 1 >= Number(job.opts.attempts ?? 1);
      await this.deliveries.markTransientFailure(
        attempt.id,
        requestError.code,
        finalAttempt,
      );
      if (!finalAttempt) throw requestError;
    }
  }
}
