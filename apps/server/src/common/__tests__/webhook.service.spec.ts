import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import { createHmac } from 'node:crypto';
import type { UrlValidator } from '../validators/url.validator';
import { WebhookService } from '../services/webhook.service';

describe('Common WebhookService', () => {
  let service: WebhookService;
  let validator: { isAllowed: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    validator = { isAllowed: vi.fn().mockResolvedValue(true) };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
    } as Response);
    service = new WebhookService(validator as unknown as UrlValidator);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('signs the exact body and sends a stable idempotency key', async () => {
    await service.send(
      'https://example.com/webhook',
      { event: 'topic.run.completed', data: { runId: 'run-1' } },
      'subscription-secret',
      'delivery-1',
    );

    const requestInit = (global.fetch as unknown as Mock).mock.calls[0][1];
    const bodyString = requestInit.body as string;
    const headers = new Headers(requestInit.headers as HeadersInit);
    const expected = createHmac('sha256', 'subscription-secret')
      .update(bodyString)
      .digest('hex');
    expect(headers.get('X-Anyhunt-Signature')).toBe(`sha256=${expected}`);
    expect(headers.get('X-Anyhunt-Event')).toBe('topic.run.completed');
    expect(headers.get('Idempotency-Key')).toBe('delivery-1');
  });

  it('revalidates redirect targets and makes an SSRF redirect permanent', async () => {
    validator.isAllowed
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 302,
      headers: new Headers({ location: 'http://127.0.0.1/internal' }),
    } as Response);

    const result = service.send(
      'https://example.com/webhook',
      { event: 'topic.run.completed', data: {} },
      'subscription-secret',
      'delivery-1',
    );

    await expect(result).rejects.toMatchObject({
      code: 'WEBHOOK_URL_BLOCKED',
      retryable: false,
    });
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('allows only the exact explicitly configured local acceptance Sink', async () => {
    vi.stubEnv(
      'ANYHUNT_LOCAL_WEBHOOK_SINK_URL',
      'http://webhook-sink:3000/acceptance',
    );

    await service.send(
      'http://webhook-sink:3000/acceptance',
      { event: 'topic.run.completed', data: {} },
      'subscription-secret',
      'delivery-1',
    );

    expect(validator.isAllowed).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledOnce();
  });
});
