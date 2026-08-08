/**
 * [INPUT]: Express Request（Authorization: Bearer <accessToken>）
 * [OUTPUT]: request.user / request.session 绑定后的鉴权结果
 * [POS]: 全局鉴权 Guard（Access Token 校验）
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthTokensService } from './auth.tokens.service';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './decorators';
import { getAuthBaseUrl, getTrustedOrigins } from './auth.config';
import { getRequestOrigin } from './auth.tokens.utils';
import { matchOrigin } from '../common/utils/origin.utils';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokensService: AuthTokensService,
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否是公开路由
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const session = await this.tokensService.verifyAccessToken(token);
      if (!session) {
        throw new UnauthorizedException('Invalid or expired access token');
      }
      request.user = session.user;
      request.session = session.session;
      return true;
    }

    const session = await this.authService.getSessionFromRequest(request);
    if (!session) {
      throw new UnauthorizedException('Authentication required');
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) {
      const origin = getRequestOrigin(request);
      const allowed = [getAuthBaseUrl(), ...getTrustedOrigins()];
      if (!origin || !allowed.some((pattern) => matchOrigin(origin, pattern))) {
        throw new ForbiddenException('Untrusted request origin');
      }
    }
    request.user = session.user;
    request.session = session.session;
    return true;
  }
}
