/**
 * [INPUT]: Authenticated reports and Admin moderation commands
 * [OUTPUT]: One report per user/Topic plus atomic moderation audit records
 * [POS]: Topic trust-and-safety application service
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calculateNextRunAt } from './topic.schema';
import type {
  AdminReportQueryDto,
  TopicReportDto,
} from './topic-report.schema';

@Injectable()
export class TopicReportService {
  constructor(private readonly prisma: PrismaService) {}

  async report(userId: string, topicId: string, input: TopicReportDto) {
    const topic = await this.prisma.topic.findFirst({
      where: {
        id: topicId,
        status: 'ACTIVE',
        visibility: 'PUBLIC',
        ownerId: { not: userId },
      },
      select: { id: true },
    });
    if (!topic) throw new NotFoundException('Reportable Topic not found');
    return this.prisma.topicReport.upsert({
      where: {
        topicId_reporterUserId: { topicId, reporterUserId: userId },
      },
      create: {
        topicId,
        reporterUserId: userId,
        reason: input.reason,
        description: input.description,
      },
      update: {
        reason: input.reason,
        description: input.description,
        status: 'PENDING',
        resolvedAt: null,
        resolvedById: null,
        resolutionNote: null,
      },
    });
  }

  async list(query: AdminReportQueryDto) {
    const where = query.status ? { status: query.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.topicReport.findMany({
        where,
        select: {
          id: true,
          reason: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          resolvedAt: true,
          resolutionNote: true,
          topic: {
            select: {
              id: true,
              slug: true,
              title: true,
              status: true,
              ownerId: true,
            },
          },
          reporter: { select: { id: true, email: true } },
          resolvedBy: { select: { id: true, email: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.topicReport.count({ where }),
    ]);
    return { items, page: query.page, limit: query.limit, total };
  }

  resolve(
    actorUserId: string,
    reportId: string,
    status: 'RESOLVED_VALID' | 'RESOLVED_INVALID',
    note: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const report = await transaction.topicReport.findUnique({
        where: { id: reportId },
        select: {
          id: true,
          topicId: true,
          topic: { select: { ownerId: true } },
        },
      });
      if (!report) throw new NotFoundException('Topic report not found');
      const resolved = await transaction.topicReport.update({
        where: { id: report.id },
        data: {
          status,
          resolutionNote: note,
          resolvedAt: new Date(),
          resolvedById: actorUserId,
        },
      });
      await transaction.adminAuditLog.create({
        data: {
          actorUserId,
          targetUserId: report.topic.ownerId,
          action: 'TOPIC_REPORT_RESOLVE',
          reason: note,
          metadata: { reportId: report.id, topicId: report.topicId, status },
        },
      });
      return resolved;
    });
  }

  setTopicStatus(
    actorUserId: string,
    topicId: string,
    status: 'ACTIVE' | 'SUSPENDED',
    reason: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const topic = await transaction.topic.findUnique({
        where: { id: topicId },
        select: {
          id: true,
          ownerId: true,
          status: true,
          enabled: true,
          cron: true,
          timezone: true,
        },
      });
      if (!topic) throw new NotFoundException('Topic not found');
      const updated = await transaction.topic.update({
        where: { id: topic.id },
        data: {
          status,
          ...(status === 'ACTIVE' && topic.enabled
            ? { nextRunAt: calculateNextRunAt(topic.cron, topic.timezone) }
            : {}),
        },
      });
      await transaction.adminAuditLog.create({
        data: {
          actorUserId,
          targetUserId: topic.ownerId,
          action: status === 'SUSPENDED' ? 'TOPIC_SUSPEND' : 'TOPIC_RESTORE',
          reason,
          metadata: { topicId: topic.id, previousStatus: topic.status },
        },
      });
      return updated;
    });
  }
}
