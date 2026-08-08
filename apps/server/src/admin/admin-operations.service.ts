/**
 * [INPUT]: Admin pagination queries and deployment-owned MCP configuration
 * [OUTPUT]: Secret-free operational projections for 1.0 product resources
 * [POS]: Read-only Admin diagnostics service
 */

import { Injectable, Optional } from '@nestjs/common';
import { parseMcpServersConfig } from '../agent/mcp/mcp.config';
import { McpClientManagerService } from '../agent/mcp/mcp-client-manager.service';
import { PrismaService } from '../prisma/prisma.service';
import type { PaginationQuery } from './dto';

@Injectable()
export class AdminOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly mcp?: McpClientManagerService,
  ) {}

  listTopics(query: PaginationQuery) {
    return this.page(
      query,
      this.prisma.topic.findMany({
        where: query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: 'insensitive' } },
                { slug: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {},
        select: {
          id: true,
          ownerId: true,
          slug: true,
          title: true,
          visibility: true,
          status: true,
          enabled: true,
          nextRunAt: true,
          lastRunAt: true,
          createdAt: true,
          owner: { select: { id: true, email: true, name: true } },
          managedSkill: {
            select: {
              id: true,
              name: true,
              enabled: true,
              currentVersion: true,
              updatedAt: true,
            },
          },
          _count: { select: { subscriptions: true, runs: true } },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: this.skip(query),
        take: query.limit,
      }),
      this.prisma.topic.count({
        where: query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: 'insensitive' } },
                { slug: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {},
      }),
    );
  }

  listSubscriptions(query: PaginationQuery) {
    return this.page(
      query,
      this.prisma.subscription.findMany({
        select: {
          id: true,
          userId: true,
          topicId: true,
          enabled: true,
          subscribedAt: true,
          canceledAt: true,
          inboxEnabled: true,
          emailEnabled: true,
          webhookEnabled: true,
          updatedAt: true,
          user: { select: { id: true, email: true, name: true } },
          topic: { select: { id: true, title: true, slug: true } },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: this.skip(query),
        take: query.limit,
      }),
      this.prisma.subscription.count(),
    );
  }

  listRuns(query: PaginationQuery) {
    return this.page(
      query,
      this.prisma.run.findMany({
        select: {
          id: true,
          topicId: true,
          status: true,
          trigger: true,
          scheduledAt: true,
          startedAt: true,
          completedAt: true,
          cancelRequestedAt: true,
          runtimeStats: true,
          errorCode: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { items: true, deliveries: true } },
        },
        orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }],
        skip: this.skip(query),
        take: query.limit,
      }),
      this.prisma.run.count(),
    );
  }

  listDeliveries(query: PaginationQuery) {
    return this.page(
      query,
      this.prisma.delivery.findMany({
        select: {
          id: true,
          runId: true,
          subscriptionId: true,
          channel: true,
          status: true,
          attemptCount: true,
          lastAttemptAt: true,
          deliveredAt: true,
          errorCode: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: this.skip(query),
        take: query.limit,
      }),
      this.prisma.delivery.count(),
    );
  }

  listSkills(query: PaginationQuery) {
    return this.page(
      query,
      this.prisma.skill.findMany({
        where: query.search
          ? { name: { contains: query.search, mode: 'insensitive' } }
          : {},
        select: {
          id: true,
          ownerId: true,
          name: true,
          description: true,
          enabled: true,
          currentVersion: true,
          archivedAt: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              managedTopics: true,
              attachedTopics: true,
              versions: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: this.skip(query),
        take: query.limit,
      }),
      this.prisma.skill.count({
        where: query.search
          ? { name: { contains: query.search, mode: 'insensitive' } }
          : {},
      }),
    );
  }

  listProviders(query: PaginationQuery) {
    return this.page(
      query,
      this.prisma.llmProvider.findMany({
        select: {
          id: true,
          name: true,
          providerType: true,
          enabled: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { models: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        skip: this.skip(query),
        take: query.limit,
      }),
      this.prisma.llmProvider.count(),
    );
  }

  listRequestLogs(query: PaginationQuery) {
    return this.page(
      query,
      this.prisma.requestLog.findMany({
        select: {
          id: true,
          createdAt: true,
          requestId: true,
          method: true,
          path: true,
          routeGroup: true,
          statusCode: true,
          durationMs: true,
          authType: true,
          userId: true,
          errorCode: true,
          retryAfter: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: this.skip(query),
        take: query.limit,
      }),
      this.prisma.requestLog.count(),
    );
  }

  getMcpStatus() {
    if (this.mcp) return this.mcp.getStatus();
    const servers = parseMcpServersConfig(process.env.ANYHUNT_MCP_SERVERS_JSON);
    return {
      servers: Object.entries(servers).map(([name, config]) => ({
        name,
        status: 'disconnected',
        tools: config.tools,
      })),
    };
  }

  private skip(query: PaginationQuery): number {
    return (query.page - 1) * query.limit;
  }

  private async page<T>(
    query: PaginationQuery,
    itemsPromise: Promise<T[]>,
    totalPromise: Promise<number>,
  ) {
    const [items, total] = await Promise.all([itemsPromise, totalPromise]);
    return { items, page: query.page, limit: query.limit, total };
  }
}
