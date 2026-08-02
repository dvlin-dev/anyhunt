import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import type { Reflector } from '@nestjs/core';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { UserThrottlerGuard } from './user-throttler.guard';

const createGuard = () =>
  new UserThrottlerGuard([], {} as ThrottlerStorage, {} as Reflector);

describe('UserThrottlerGuard', () => {
  it('uses the user id when an authenticated session exists', async () => {
    const guard = createGuard();
    const tracker = await (
      guard as unknown as { getTracker: (req: Request) => Promise<string> }
    ).getTracker({
      user: { id: 'user_123' },
      ip: '127.0.0.1',
    } as unknown as Request);

    expect(tracker).toBe('user:user_123');
  });

  it('uses the IP address when identity is missing', async () => {
    const guard = createGuard();
    const tracker = await (
      guard as unknown as { getTracker: (req: Request) => Promise<string> }
    ).getTracker({
      ip: '127.0.0.1',
    } as unknown as Request);

    expect(tracker).toBe('ip:127.0.0.1');
  });
});
