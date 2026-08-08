/**
 * [INPUT]: 用户身份与资料修改命令
 * [OUTPUT]: 用户资料或账号生命周期结果
 * [POS]: 用户资料、密码与账号删除服务
 */

import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { PrismaService } from '../prisma';
import type {
  ChangePasswordDto,
  DeleteAccountDto,
  UpdateProfileDto,
} from './dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        createdAt: true,
      },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const account = await this.prisma.account.findFirst({
      where: { userId, providerId: 'credential' },
    });

    if (!account?.password) {
      throw new BadRequestException('Password authentication not enabled');
    }

    const isValid = await verifyPassword({
      password: dto.currentPassword,
      hash: account.password,
    });

    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.prisma.account.update({
      where: { id: account.id },
      data: { password: await hashPassword(dto.newPassword) },
    });
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (dto.confirmation !== user.email) {
      throw new BadRequestException('Confirmation email does not match');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.accountDeletionRecord.create({
        data: {
          userIdHash: this.hashDeletionIdentity(user.id),
          emailHash: this.hashDeletionIdentity(user.email.trim().toLowerCase()),
          reason: dto.reason,
          feedback: dto.feedback,
        },
      });
      await tx.requestLog.updateMany({
        where: { userId },
        data: {
          userId: null,
          clientIp: 'anonymized',
          forwardedFor: null,
          origin: null,
          referer: null,
          userAgent: null,
        },
      });
      await tx.adminAuditLog.updateMany({
        where: { targetUserId: userId },
        data: { targetUserId: null },
      });
      await tx.adminAuditLog.updateMany({
        where: { actorUserId: userId },
        data: { actorUserId: 'deleted-user' },
      });
      // User-owned Topics/Skills and all personal relations are removed by
      // explicit database cascades from this single hard-delete boundary.
      await tx.user.delete({ where: { id: userId } });
    });
  }

  private hashDeletionIdentity(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }
}
