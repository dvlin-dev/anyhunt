/**
 * [INPUT]: Public Topic slug/list queries and optional viewer identity
 * [OUTPUT]: Permission-filtered Topic and successful Run projections
 * [POS]: Read-only public Topic access matrix
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Viewer = { id: string; isAdmin: boolean } | null | undefined;

@Injectable()
export class PublicTopicService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page: number, limit: number) {
    const where = { visibility: 'PUBLIC' as const, status: 'ACTIVE' as const };
    const [items, total] = await Promise.all([
      this.prisma.topic.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title: true,
          goal: true,
          description: true,
          locale: true,
          cron: true,
          timezone: true,
          lastRunAt: true,
          nextRunAt: true,
          _count: { select: { subscriptions: true } },
        },
        orderBy: [{ lastRunAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.topic.count({ where }),
    ]);
    return { items, page, limit, total };
  }

  async getBySlug(slug: string, viewer: Viewer) {
    const topic = await this.prisma.topic.findUnique({
      where: { slug },
      select: {
        id: true,
        ownerId: true,
        slug: true,
        title: true,
        goal: true,
        description: true,
        visibility: true,
        status: true,
        locale: true,
        cron: true,
        timezone: true,
        lastRunAt: true,
        nextRunAt: true,
        _count: { select: { subscriptions: true } },
        runs: {
          where: { status: 'SUCCEEDED' },
          select: {
            id: true,
            completedAt: true,
            narrative: true,
            items: {
              select: {
                canonicalUrlHash: true,
                title: true,
                url: true,
                summary: true,
                selectionReason: true,
                rank: true,
                retrievedAt: true,
                sourceTitle: true,
              },
              orderBy: [{ rank: 'asc' }, { id: 'asc' }],
            },
          },
          orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
          take: 1,
        },
      },
    });
    if (!topic || !this.canRead(topic, viewer)) {
      throw new NotFoundException('Topic not found');
    }
    return topic;
  }

  async getRunBySlug(slug: string, runId: string, viewer: Viewer) {
    const topic = await this.getBySlug(slug, viewer);
    const run = await this.prisma.run.findFirst({
      where: { id: runId, topicId: topic.id, status: 'SUCCEEDED' },
      select: {
        id: true,
        scheduledAt: true,
        completedAt: true,
        narrative: true,
        items: {
          select: {
            canonicalUrlHash: true,
            title: true,
            url: true,
            summary: true,
            selectionReason: true,
            rank: true,
            retrievedAt: true,
            sourceTitle: true,
          },
          orderBy: [{ rank: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!run) throw new NotFoundException('Run not found');
    return { topic, run };
  }

  private canRead(
    topic: {
      ownerId: string;
      visibility: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
      status: 'ACTIVE' | 'SUSPENDED';
    },
    viewer: Viewer,
  ): boolean {
    const privileged = Boolean(
      viewer && (viewer.isAdmin || viewer.id === topic.ownerId),
    );
    if (topic.status === 'SUSPENDED') return privileged;
    if (topic.visibility === 'PRIVATE') return privileged;
    return true;
  }
}
