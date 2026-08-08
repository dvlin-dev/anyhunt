import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionPreferencesSchema } from '../subscription.schema';

describe('SubscriptionPreferencesSchema', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('requires HTTPS by default', () => {
    expect(
      SubscriptionPreferencesSchema.safeParse({
        webhookUrl: 'https://hooks.example.com/anyhunt',
      }).success,
    ).toBe(true);
    expect(
      SubscriptionPreferencesSchema.safeParse({
        webhookUrl: 'http://hooks.example.com/anyhunt',
      }).success,
    ).toBe(false);
  });

  it('allows only the exact explicitly configured local acceptance Sink', () => {
    vi.stubEnv(
      'ANYHUNT_LOCAL_WEBHOOK_SINK_URL',
      'http://webhook-sink:3000/acceptance',
    );

    expect(
      SubscriptionPreferencesSchema.safeParse({
        webhookUrl: 'http://webhook-sink:3000/acceptance',
      }).success,
    ).toBe(true);
    expect(
      SubscriptionPreferencesSchema.safeParse({
        webhookUrl: 'http://webhook-sink:3000/other',
      }).success,
    ).toBe(false);
  });
});
