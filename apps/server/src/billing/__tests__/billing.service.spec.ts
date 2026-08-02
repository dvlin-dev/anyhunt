import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DuplicateRefundError } from '../../quota/quota.errors';
import type { DeductResult } from '../../quota/quota.types';
import { BillingService } from '../billing.service';

describe('BillingService', () => {
  const deduct: DeductResult = {
    success: true,
    breakdown: [
      {
        source: 'MONTHLY',
        amount: 1,
        transactionId: 'tx-1',
        balanceBefore: 10,
        balanceAfter: 9,
      },
    ],
  };
  let quota: {
    deductOrThrow: ReturnType<typeof vi.fn>;
    refund: ReturnType<typeof vi.fn>;
  };
  let service: BillingService;

  beforeEach(() => {
    quota = { deductOrThrow: vi.fn(), refund: vi.fn() };
    service = new BillingService(quota as never);
  });

  it('charges a Digest acquisition with a stable reference', async () => {
    quota.deductOrThrow.mockResolvedValue(deduct);

    await service.deductOrThrow({
      userId: 'user-1',
      billingKey: 'digest.acquire.search',
      referenceId: 'run-1',
    });

    expect(quota.deductOrThrow).toHaveBeenCalledWith(
      'user-1',
      1,
      'digest.acquire.search:run-1',
      undefined,
    );
  });

  it('does not charge a cached scrape', async () => {
    await expect(
      service.deductOrThrow({
        userId: 'user-1',
        billingKey: 'digest.acquire.scrape',
        referenceId: 'run-1',
        fromCache: true,
      }),
    ).resolves.toBeNull();
    expect(quota.deductOrThrow).not.toHaveBeenCalled();
  });

  it('refunds a failed acquisition idempotently', async () => {
    quota.refund.mockRejectedValue(new DuplicateRefundError('already refunded'));

    await expect(
      service.refundOnFailure({
        userId: 'user-1',
        billingKey: 'digest.acquire.map',
        referenceId: 'run-1',
        breakdown: deduct.breakdown,
      }),
    ).resolves.toEqual({ success: true });
    expect(quota.refund).toHaveBeenCalledWith({
      userId: 'user-1',
      referenceId: 'refund:tx-1',
      deductTransactionId: 'tx-1',
      source: 'MONTHLY',
      amount: 1,
    });
  });
});
