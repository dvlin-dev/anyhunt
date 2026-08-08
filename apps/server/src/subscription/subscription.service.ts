/**
 * [INPUT]: Authenticated follow/cancel/preference commands
 * [OUTPUT]: Idempotent pure Subscription state
 * [POS]: Subscription application service; owns no research or Agent settings
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSecretService } from '../common/services/data-secret.service';
import { isConfiguredLocalWebhookSink } from '../common/utils/local-webhook-sink';
import { UrlValidator } from '../common/validators/url.validator';
import { PrismaService } from '../prisma/prisma.service';
import type { SubscriptionPreferencesDto } from './subscription.schema';
import type { Prisma } from '../../generated/prisma-main/client';

const PUBLIC_SUBSCRIPTION_SELECT = {
  id: true,
  userId: true,
  topicId: true,
  enabled: true,
  subscribedAt: true,
  canceledAt: true,
  inboxEnabled: true,
  emailEnabled: true,
  webhookEnabled: true,
  webhookUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SubscriptionSelect;

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: DataSecretService,
    private readonly urlValidator: UrlValidator,
  ) {}

  list(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId },
      select: {
        ...PUBLIC_SUBSCRIPTION_SELECT,
        topic: {
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            visibility: true,
            status: true,
            locale: true,
            lastRunAt: true,
            nextRunAt: true,
          },
        },
      },
      orderBy: [{ subscribedAt: 'desc' }, { id: 'asc' }],
    });
  }

  async subscribe(userId: string, topicId: string) {
    const topic = await this.prisma.topic.findFirst({
      where: {
        id: topicId,
        status: 'ACTIVE',
        OR: [
          { ownerId: userId },
          { visibility: { in: ['PUBLIC', 'UNLISTED'] } },
        ],
      },
      select: { id: true },
    });
    if (!topic) throw new NotFoundException('Subscribable Topic not found');

    const existing = await this.prisma.subscription.findUnique({
      where: { userId_topicId: { userId, topicId } },
      select: PUBLIC_SUBSCRIPTION_SELECT,
    });
    if (existing?.enabled) return existing;
    if (existing) {
      return this.prisma.subscription.update({
        where: { id: existing.id },
        data: { enabled: true, canceledAt: null },
        select: PUBLIC_SUBSCRIPTION_SELECT,
      });
    }
    return this.prisma.subscription.create({
      data: { userId, topicId, inboxEnabled: true },
      select: PUBLIC_SUBSCRIPTION_SELECT,
    });
  }

  async cancel(userId: string, topicId: string) {
    const result = await this.prisma.subscription.updateMany({
      where: { userId, topicId, enabled: true },
      data: { enabled: false, canceledAt: new Date() },
    });
    if (result.count === 0)
      throw new NotFoundException('Active Subscription not found');
    return this.prisma.subscription.findFirstOrThrow({
      where: { userId, topicId },
      select: PUBLIC_SUBSCRIPTION_SELECT,
    });
  }

  async updatePreferences(
    userId: string,
    topicId: string,
    input: SubscriptionPreferencesDto,
  ) {
    const subscription = await this.prisma.subscription.findFirstOrThrow({
      where: { userId, topicId, enabled: true },
      select: {
        id: true,
        webhookUrl: true,
        webhookSecretEncrypted: true,
      },
    });
    const webhookUrl = input.webhookUrl ?? subscription.webhookUrl;
    const encryptedSecret = input.webhookSecret
      ? this.secrets.encrypt('subscription-webhook', input.webhookSecret)
      : subscription.webhookSecretEncrypted;
    if (
      input.webhookUrl &&
      !isConfiguredLocalWebhookSink(input.webhookUrl) &&
      !(await this.urlValidator.isAllowed(input.webhookUrl))
    ) {
      throw new BadRequestException('Webhook URL is not allowed');
    }
    if (input.webhookEnabled && (!webhookUrl || !encryptedSecret)) {
      throw new BadRequestException(
        'Webhook URL and secret are required before enabling delivery',
      );
    }
    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        ...(input.inboxEnabled === undefined
          ? {}
          : { inboxEnabled: input.inboxEnabled }),
        ...(input.emailEnabled === undefined
          ? {}
          : { emailEnabled: input.emailEnabled }),
        ...(input.webhookEnabled === undefined
          ? {}
          : { webhookEnabled: input.webhookEnabled }),
        ...(input.webhookUrl === undefined
          ? {}
          : { webhookUrl: input.webhookUrl }),
        ...(input.webhookSecret === undefined
          ? {}
          : { webhookSecretEncrypted: encryptedSecret }),
      },
      select: {
        ...PUBLIC_SUBSCRIPTION_SELECT,
      },
    });
  }
}
