/**
 * [INPUT]: EMAIL Delivery queue job
 * [OUTPUT]: One verified-address email and durable terminal/retry state
 * [POS]: Email channel adapter
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { EmailService } from '../email/email.service';
import { EMAIL_DELIVERY_QUEUE } from '../queue/queue.constants';
import { DeliveryService } from './delivery.service';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!,
  );
}

@Processor(EMAIL_DELIVERY_QUEUE, { concurrency: 5 })
export class EmailDeliveryProcessor extends WorkerHost {
  constructor(
    private readonly deliveries: DeliveryService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<{ deliveryId: string }>): Promise<void> {
    const attempt = await this.deliveries.claim(job.data.deliveryId, 'EMAIL');
    if (!attempt) return;
    if (!this.email.isConfigured()) {
      await this.deliveries.markPermanentFailure(
        attempt.id,
        'EMAIL_NOT_CONFIGURED',
      );
      return;
    }
    const token = this.deliveries.createUnsubscribeToken(
      attempt.subscriptionId,
    );
    const baseUrl = this.config.get<string>(
      'BETTER_AUTH_URL',
      'http://localhost:3000',
    );
    const unsubscribeUrl = new URL(
      `/api/v1/deliveries/unsubscribe/${encodeURIComponent(token)}`,
      baseUrl,
    ).toString();
    const items = attempt.payload.items
      .map(
        (item) =>
          `<li><a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a><p>${escapeHtml(item.summary)}</p></li>`,
      )
      .join('');
    const html = [
      `<h1>${escapeHtml(attempt.payload.topic.title)}</h1>`,
      attempt.payload.narrative
        ? `<p>${escapeHtml(attempt.payload.narrative)}</p>`
        : '',
      `<ol>${items}</ol>`,
      `<p><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from email updates</a></p>`,
    ].join('');
    try {
      await this.email.sendEmail(
        attempt.email,
        `${attempt.payload.topic.title} — research update`,
        html,
        {
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            'X-Entity-Ref-ID': attempt.id,
          },
        },
      );
      await this.deliveries.markDelivered(attempt.id);
    } catch {
      const finalAttempt =
        job.attemptsMade + 1 >= Number(job.opts.attempts ?? 1);
      await this.deliveries.markTransientFailure(
        attempt.id,
        'EMAIL_SEND_FAILED',
        finalAttempt,
      );
      if (!finalAttempt) throw new Error('EMAIL_SEND_FAILED');
    }
  }
}
