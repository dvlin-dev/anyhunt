import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DataSecretService } from '../services/data-secret.service';

describe('DataSecretService', () => {
  const previous = process.env.ANYHUNT_DATA_SECRET_KEY;
  const service = new DataSecretService();

  beforeEach(() => {
    process.env.ANYHUNT_DATA_SECRET_KEY = Buffer.alloc(32, 7).toString('base64');
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.ANYHUNT_DATA_SECRET_KEY;
    else process.env.ANYHUNT_DATA_SECRET_KEY = previous;
  });

  it('binds ciphertext to its purpose', () => {
    const encrypted = service.encrypt('subscription-webhook', 'private-value');
    expect(service.decrypt('subscription-webhook', encrypted)).toBe(
      'private-value',
    );
    expect(() => service.decrypt('different-purpose', encrypted)).toThrow();
    expect(encrypted).not.toContain('private-value');
  });

  it('rejects tampered action tokens', () => {
    const token = service.signToken('delivery-unsubscribe', 'subscription-1');
    expect(service.verifyToken('delivery-unsubscribe', token)).toBe(
      'subscription-1',
    );
    expect(service.verifyToken('delivery-unsubscribe', `${token}x`)).toBeNull();
    expect(service.verifyToken('different-purpose', token)).toBeNull();
  });
});
