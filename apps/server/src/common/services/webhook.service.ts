/**
 * [INPUT]: HTTPS webhook URL（或精确配置的本地验收 Sink）、订阅密钥、事件载荷与稳定 Delivery ID
 * [OUTPUT]: Signed SSRF-safe POST or typed retryability error
 * [POS]: Shared outbound webhook transport; contains no Delivery persistence
 */

import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { UrlValidator } from '../validators/url.validator';
import {
  fetchWithSsrGuard,
  TooManyRedirectsError,
  UnsafeUrlError,
} from '../utils/ssrf-fetch';
import { isConfiguredLocalWebhookSink } from '../utils/local-webhook-sink';

export interface WebhookPayload {
  event: string;
  data: unknown;
}

export class WebhookRequestError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = 'WebhookRequestError';
  }
}

@Injectable()
export class WebhookService {
  constructor(private readonly urlValidator: UrlValidator) {}

  async send(
    url: string,
    payload: WebhookPayload,
    secret: string,
    deliveryId: string,
  ): Promise<void> {
    const bodyString = JSON.stringify({
      ...payload,
      deliveryId,
      timestamp: new Date().toISOString(),
    });
    const signature = createHmac('sha256', secret)
      .update(bodyString)
      .digest('hex');

    try {
      const requestInit: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': deliveryId,
          'X-Anyhunt-Event': payload.event,
          'X-Anyhunt-Signature': `sha256=${signature}`,
        },
        body: bodyString,
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
      };
      const response = isConfiguredLocalWebhookSink(url)
        ? await fetch(url, { ...requestInit, redirect: 'error' })
        : await fetchWithSsrGuard(this.urlValidator, url, {
            ...requestInit,
            maxRedirects: 3,
          });
      if (response.ok) return;
      const retryable =
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500;
      throw new WebhookRequestError(`UPSTREAM_${response.status}`, retryable);
    } catch (error) {
      if (error instanceof WebhookRequestError) throw error;
      if (
        error instanceof UnsafeUrlError ||
        error instanceof TooManyRedirectsError
      ) {
        throw new WebhookRequestError('WEBHOOK_URL_BLOCKED', false);
      }
      throw new WebhookRequestError('WEBHOOK_NETWORK_ERROR', true);
    }
  }
}
