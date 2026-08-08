/**
 * [INPUT]: User subscriptions, query filters, and personal item state
 * [OUTPUT]: Paginated RunItem projection with per-user state
 * [POS]: Query-only Inbox; no Inbox persistence model
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma-main/client';
import { PrismaService } from '../prisma/prisma.service';
import type { InboxQueryDto, UserItemStateDto } from './inbox.schema';

type SubscriptionWindow = {
  topicId: string;
  subscribedAt: Date;
  canceledAt: Date | null;
};

function windowFilters(windows: SubscriptionWindow[]) {
  return windows.map((subscription) => ({
    run: {
      topicId: subscription.topicId,
      completedAt: {
        gte: subscription.subscribedAt,
        ...(subscription.canceledAt ? { lte: subscription.canceledAt } : {}),
      },
    },
  }));
}

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  private subscriptionWindows(userId: string, topicId?: string) {
    return this.prisma.subscription.findMany({
      where: {
        userId,
        inboxEnabled: true,
        ...(topicId ? { topicId } : {}),
      },
      select: { topicId: true, subscribedAt: true, canceledAt: true },
    });
  }

  async list(userId: string, query: InboxQueryDto) {
    const windows = await this.subscriptionWindows(userId, query.topicId);
    if (windows.length === 0) {
      return { items: [], page: query.page, limit: query.limit, total: 0 };
    }
    const requestedStateFilters = [
      ['isRead', 'readAt', query.isRead],
      ['isSaved', 'savedAt', query.isSaved],
      ['isNotInterested', 'notInterestedAt', query.isNotInterested],
    ] as const;
    const requestedStateNames = requestedStateFilters
      .filter(([, , value]) => value !== undefined)
      .map(([, name]) => name);
    const matchingStates =
      requestedStateNames.length === 0
        ? []
        : await this.prisma.userItemState.findMany({
            where: {
              userId,
              OR: requestedStateNames.map((name) => ({
                [name]: { not: null },
              })),
            },
            select: {
              canonicalUrlHash: true,
              readAt: true,
              savedAt: true,
              notInterestedAt: true,
            },
          });
    const stateFilters: Prisma.RunItemWhereInput[] =
      requestedStateFilters.flatMap(([, name, expected]) => {
        if (expected === undefined) return [];
        const hashes = matchingStates
          .filter((state) => state[name] !== null)
          .map((state) => state.canonicalUrlHash);
        return [
          expected
            ? { canonicalUrlHash: { in: hashes } }
            : { canonicalUrlHash: { notIn: hashes } },
        ];
      });
    const where: Prisma.RunItemWhereInput = {
      run: { status: 'SUCCEEDED' },
      OR: windowFilters(windows),
      ...(stateFilters.length > 0 ? { AND: stateFilters } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.runItem.findMany({
        where,
        include: {
          run: {
            select: {
              id: true,
              completedAt: true,
              narrative: true,
              topic: { select: { id: true, slug: true, title: true } },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.runItem.count({ where }),
    ]);
    const itemStates = await this.prisma.userItemState.findMany({
      where: {
        userId,
        canonicalUrlHash: { in: items.map((item) => item.canonicalUrlHash) },
      },
    });
    const stateByHash = new Map(
      itemStates.map((state) => [state.canonicalUrlHash, state]),
    );
    return {
      items: items.map((item) => ({
        ...item,
        state: (() => {
          const state = stateByHash.get(item.canonicalUrlHash);
          return {
            isRead: state?.readAt != null,
            isSaved: state?.savedAt != null,
            isNotInterested: state?.notInterestedAt != null,
          };
        })(),
      })),
      page: query.page,
      limit: query.limit,
      total,
    };
  }

  async updateState(
    userId: string,
    canonicalUrlHash: string,
    input: UserItemStateDto,
  ) {
    const windows = await this.subscriptionWindows(userId);
    const accessible = await this.prisma.runItem.findFirst({
      where: {
        canonicalUrlHash,
        run: { status: 'SUCCEEDED' },
        OR: windowFilters(windows),
      },
      select: { id: true },
    });
    if (!accessible) throw new NotFoundException('Inbox item not found');
    const now = new Date();
    const stateData = {
      ...(input.isRead === undefined
        ? {}
        : { readAt: input.isRead ? now : null }),
      ...(input.isSaved === undefined
        ? {}
        : { savedAt: input.isSaved ? now : null }),
      ...(input.isNotInterested === undefined
        ? {}
        : { notInterestedAt: input.isNotInterested ? now : null }),
    } satisfies Prisma.UserItemStateUpdateInput;
    const state = await this.prisma.userItemState.upsert({
      where: {
        userId_canonicalUrlHash: { userId, canonicalUrlHash },
      },
      create: { userId, canonicalUrlHash, ...stateData },
      update: stateData,
    });
    return {
      isRead: state.readAt != null,
      isSaved: state.savedAt != null,
      isNotInterested: state.notInterestedAt != null,
    };
  }
}
