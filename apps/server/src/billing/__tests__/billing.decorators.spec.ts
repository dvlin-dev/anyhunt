import { describe, expect, it } from 'vitest';
import { Reflector } from '@nestjs/core';
import { BillingKey, BILLING_KEY_METADATA } from '../billing.decorators';

describe('BillingKey decorator', () => {
  it.each([
    'digest.acquire.scrape',
    'digest.acquire.search',
    'digest.acquire.map',
  ] as const)('stores the Digest billing key %s', (billingKey) => {
    class TestController {
      @BillingKey(billingKey)
      run() {}
    }

    expect(
      new Reflector().get(
        BILLING_KEY_METADATA,
        TestController.prototype.run,
      ),
    ).toBe(billingKey);
  });
});
