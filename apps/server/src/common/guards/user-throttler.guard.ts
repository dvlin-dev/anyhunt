/**
 * User Throttler Guard
 * 基于用户 ID 的限流守卫
 *
 * 已登录用户基于用户 ID，未登录用户基于 IP 地址。
 */

import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request): Promise<string> {
    const user = req.user as { id?: string } | undefined;
    if (user?.id) {
      return Promise.resolve(`user:${user.id}`);
    }
    return Promise.resolve(`ip:${req.ip}`);
  }
}
