/**
 * AuthGuard 单元测试
 */

import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '../auth.guard';
import type { AuthTokensService } from '../auth.tokens.service';
import type { AuthService } from '../auth.service';

describe('AuthGuard', () => {
  const createContext = (request: Record<string, unknown>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: vi.fn(),
      getClass: vi.fn(),
    }) as any;

  it('should allow public routes', async () => {
    const guard = new AuthGuard(
      {
        verifyAccessToken: vi.fn(),
      } as unknown as AuthTokensService,
      { getSessionFromRequest: vi.fn() } as unknown as AuthService,
      {
        getAllAndOverride: vi.fn().mockReturnValue(true),
      } as any,
    );

    const result = await guard.canActivate(createContext({ headers: {} }));

    expect(result).toBe(true);
  });

  it('should reject missing bearer token', async () => {
    const guard = new AuthGuard(
      {
        verifyAccessToken: vi.fn(),
      } as unknown as AuthTokensService,
      {
        getSessionFromRequest: vi.fn().mockResolvedValue(null),
      } as unknown as AuthService,
      {
        getAllAndOverride: vi.fn().mockReturnValue(false),
      } as any,
    );

    await expect(
      guard.canActivate(createContext({ headers: {} })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should attach user when token is valid', async () => {
    const verifyAccessToken = vi.fn().mockResolvedValue({
      session: { id: 'session_1', expiresAt: new Date() },
      user: {
        id: 'user_1',
        email: 'user@example.com',
        name: 'User',
        isAdmin: false,
      },
    });

    const guard = new AuthGuard(
      { verifyAccessToken } as unknown as AuthTokensService,
      { getSessionFromRequest: vi.fn() } as unknown as AuthService,
      {
        getAllAndOverride: vi.fn().mockReturnValue(false),
      } as any,
    );

    const request = { headers: { authorization: 'Bearer token' } } as any;
    const result = await guard.canActivate(createContext(request));

    expect(result).toBe(true);
    expect(request.user?.id).toBe('user_1');
    expect(request.session?.id).toBe('session_1');
  });

  it('accepts an Admin cookie session only from a trusted origin for writes', async () => {
    const previousOrigins = process.env.TRUSTED_ORIGINS;
    process.env.TRUSTED_ORIGINS = 'https://console.anyhunt.app';
    const session = {
      session: { id: 'admin-session', expiresAt: new Date() },
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Admin',
        isAdmin: true,
      },
    };
    const guard = new AuthGuard(
      { verifyAccessToken: vi.fn() } as unknown as AuthTokensService,
      {
        getSessionFromRequest: vi.fn().mockResolvedValue(session),
      } as unknown as AuthService,
      { getAllAndOverride: vi.fn().mockReturnValue(false) } as any,
    );
    const request = {
      method: 'POST',
      headers: {
        cookie: 'session=valid',
        origin: 'https://console.anyhunt.app',
      },
    } as any;

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user.isAdmin).toBe(true);

    request.headers.origin = 'https://attacker.example';
    delete request.user;
    delete request.session;
    await expect(guard.canActivate(createContext(request))).rejects.toThrow(
      ForbiddenException,
    );

    if (previousOrigins === undefined) delete process.env.TRUSTED_ORIGINS;
    else process.env.TRUSTED_ORIGINS = previousOrigins;
  });
});
