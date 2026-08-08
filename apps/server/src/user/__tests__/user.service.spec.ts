import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user.service';

describe('UserService account deletion', () => {
  it('hard-deletes the user graph and anonymizes identifiable logs', async () => {
    const user = {
      id: 'user-1',
      email: 'User@Example.com',
      deletedAt: null,
    };
    const transaction = {
      accountDeletionRecord: { create: vi.fn().mockResolvedValue({}) },
      requestLog: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
      adminAuditLog: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      user: { delete: vi.fn().mockResolvedValue(user) },
    };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(user) },
      $transaction: vi
        .fn()
        .mockImplementation((callback) => callback(transaction)),
    } as unknown as PrismaService;

    await new UserService(prisma).deleteAccount('user-1', {
      confirmation: 'User@Example.com',
      reason: 'other',
      feedback: 'No longer needed.',
    });

    expect(transaction.accountDeletionRecord.create).toHaveBeenCalledWith({
      data: {
        userIdHash: createHash('sha256').update('user-1').digest('hex'),
        emailHash: createHash('sha256')
          .update('user@example.com')
          .digest('hex'),
        reason: 'other',
        feedback: 'No longer needed.',
      },
    });
    expect(transaction.requestLog.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        userId: null,
        clientIp: 'anonymized',
        forwardedFor: null,
        origin: null,
        referer: null,
        userAgent: null,
      },
    });
    expect(transaction.adminAuditLog.updateMany).toHaveBeenCalledTimes(2);
    expect(transaction.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
  });

  it('does not mutate data when confirmation does not match', async () => {
    const transactionSpy = vi.fn();
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          email: 'user@example.com',
        }),
      },
      $transaction: transactionSpy,
    } as unknown as PrismaService;

    await expect(
      new UserService(prisma).deleteAccount('user-1', {
        confirmation: 'other@example.com',
        reason: 'other',
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(transactionSpy).not.toHaveBeenCalled();
  });
});
