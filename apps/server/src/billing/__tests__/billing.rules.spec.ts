import { afterEach, describe, expect, it, vi } from 'vitest';
import { BILLING_KEYS } from '../billing.rules';

describe('billing rules', () => {
  afterEach(() => {
    delete process.env.BILLING_RULE_OVERRIDES_JSON;
    vi.resetModules();
  });

  it('exposes only Digest acquisition operations', () => {
    expect(BILLING_KEYS).toEqual([
      'digest.acquire.scrape',
      'digest.acquire.search',
      'digest.acquire.map',
    ]);
  });

  it('skips cached scrape results and refunds acquisition failures', async () => {
    const { getBillingRule } = await import('../billing.rules');

    expect(getBillingRule('digest.acquire.scrape')).toEqual({
      cost: 1,
      skipIfFromCache: true,
      refundOnFailure: true,
    });
    expect(getBillingRule('digest.acquire.search')).toEqual({
      cost: 1,
      refundOnFailure: true,
    });
  });

  it('accepts valid cost overrides and ignores unknown keys', async () => {
    process.env.BILLING_RULE_OVERRIDES_JSON = JSON.stringify({
      'digest.acquire.search': 3,
      'legacy.operation': 99,
    });
    vi.resetModules();
    const { getBillingRule } = await import('../billing.rules');

    expect(getBillingRule('digest.acquire.search').cost).toBe(3);
    expect(getBillingRule('digest.acquire.map').cost).toBe(1);
  });
});
