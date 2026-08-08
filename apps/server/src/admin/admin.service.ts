/**
 * [INPUT]: Admin 用户查询与资料管理命令
 * [OUTPUT]: 用户运营统计、分页用户与审计安全的资料结果
 * [POS]: 不包含商业化和产品领域逻辑的 Admin 用户服务
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import type { UpdateUserDto, UserQuery } from './dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    const [
      totalUsers,
      newUsersToday,
      adminUsers,
      totalTopics,
      activeRuns,
      failedRuns,
      pendingDeliveries,
      pendingReports,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: startOfToday } },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, isAdmin: true },
      }),
      this.prisma.topic.count(),
      this.prisma.run.count({
        where: { status: { in: ['QUEUED', 'RUNNING'] } },
      }),
      this.prisma.run.count({ where: { status: 'FAILED' } }),
      this.prisma.delivery.count({ where: { status: 'PENDING' } }),
      this.prisma.topicReport.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      totalUsers,
      newUsersToday,
      adminUsers,
      totalTopics,
      activeRuns,
      failedRuns,
      pendingDeliveries,
      pendingReports,
    };
  }

  async getChartData() {
    const now = new Date();
    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - (6 - index));
      date.setUTCHours(0, 0, 0, 0);
      return date;
    });
    const from = dates[0];

    const rows = await this.prisma.$queryRaw<
      Array<{ day: string; count: number }>
    >`
      SELECT
        to_char(("createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS count
      FROM "User"
      WHERE "createdAt" >= ${from}
        AND "deletedAt" IS NULL
      GROUP BY day
      ORDER BY day
    `;
    const byDay = new Map(rows.map((row) => [row.day, row.count]));

    return {
      registrations: dates.map((date) => {
        const day = date.toISOString().slice(0, 10);
        return { date: day, value: byDay.get(day) ?? 0 };
      }),
    };
  }

  async getUsers(query: UserQuery) {
    const { page, limit, search, isAdmin } = query;
    const skip = (page - 1) * limit;
    const where = {
      deletedAt: null,
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(isAdmin !== undefined && { isAdmin }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          isAdmin: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        emailVerified: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const exists = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: { id: true, email: true, name: true, isAdmin: true },
    });
  }

  async deleteUser(id: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('User not found');
    }

    const revokedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { deletedAt: revokedAt },
      });
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt },
      });
    });
  }
}
