/**
 * [INPUT]: Completed Run IDs, Delivery worker claims, and unsubscribe tokens
 * [OUTPUT]: Durable idempotent Delivery rows and bounded queue jobs
 * [POS]: Delivery state authority; transports remain in channel processors
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { DeliveryChannel } from '../../generated/prisma-main/client';
import { DataSecretService } from '../common/services/data-secret.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  EMAIL_DELIVERY_QUEUE,
  WEBHOOK_DELIVERY_QUEUE,
} from '../queue/queue.constants';

const JOB_OPTIONS = {
  attempts: 4,
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: 100,
  removeOnFail: 500,
} as const;
const UNSUBSCRIBE_PURPOSE = 'delivery-unsubscribe';

export interface DeliveryAttempt {
  id: string;
  channel: DeliveryChannel;
  subscriptionId: string;
  email: string;
  webhookUrl: string | null;
  webhookSecretEncrypted: string | null;
  payload: {
    runId: string;
    completedAt: Date;
    narrative: string | null;
    topic: { id: string; slug: string; title: string };
    items: Array<{
      title: string;
      url: string;
      summary: string;
      selectionReason: string;
      rank: number;
    }>;
  };
}

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(EMAIL_DELIVERY_QUEUE)
    private readonly emailQueue: Queue,
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE)
    private readonly webhookQueue: Queue,
    private readonly secrets: DataSecretService,
  ) {}

  async enqueueForRun(runId: string): Promise<void> {
    const run = await this.prisma.run.findFirst({
      where: { id: runId, status: 'SUCCEEDED', topic: { status: 'ACTIVE' } },
      select: {
        id: true,
        completedAt: true,
        topic: {
          select: {
            status: true,
            subscriptions: {
              where: { enabled: true },
              select: {
                id: true,
                subscribedAt: true,
                canceledAt: true,
                emailEnabled: true,
                webhookEnabled: true,
                webhookUrl: true,
                webhookSecretEncrypted: true,
                user: { select: { email: true, emailVerified: true } },
              },
            },
          },
        },
      },
    });
    if (!run?.completedAt) return;

    const data = run.topic.subscriptions.flatMap((subscription) => {
      const activeAtCompletion =
        subscription.subscribedAt <= run.completedAt! &&
        (!subscription.canceledAt ||
          subscription.canceledAt >= run.completedAt!);
      if (!activeAtCompletion) return [];
      const channels: DeliveryChannel[] = [];
      if (subscription.emailEnabled && subscription.user.emailVerified) {
        channels.push('EMAIL');
      }
      if (
        subscription.webhookEnabled &&
        subscription.webhookUrl &&
        subscription.webhookSecretEncrypted
      ) {
        channels.push('WEBHOOK');
      }
      return channels.map((channel) => ({
        runId: run.id,
        subscriptionId: subscription.id,
        channel,
      }));
    });
    if (data.length === 0) return;

    await this.prisma.delivery.createMany({ data, skipDuplicates: true });
    const pending = await this.prisma.delivery.findMany({
      where: { runId, status: 'PENDING' },
      select: { id: true, channel: true },
    });
    await Promise.all(
      pending.map((delivery) =>
        (delivery.channel === 'EMAIL'
          ? this.emailQueue
          : this.webhookQueue
        ).add(
          'deliver',
          { deliveryId: delivery.id },
          { ...JOB_OPTIONS, jobId: delivery.id },
        ),
      ),
    );
  }

  async claim(
    deliveryId: string,
    channel: DeliveryChannel,
  ): Promise<DeliveryAttempt | null> {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        run: {
          select: {
            id: true,
            status: true,
            completedAt: true,
            narrative: true,
            topic: {
              select: { id: true, slug: true, title: true, status: true },
            },
            items: {
              select: {
                title: true,
                url: true,
                summary: true,
                selectionReason: true,
                rank: true,
              },
              orderBy: [{ rank: 'asc' }, { id: 'asc' }],
            },
          },
        },
        subscription: {
          select: {
            id: true,
            enabled: true,
            canceledAt: true,
            emailEnabled: true,
            webhookEnabled: true,
            webhookUrl: true,
            webhookSecretEncrypted: true,
            user: {
              select: { email: true, emailVerified: true, deletedAt: true },
            },
          },
        },
      },
    });
    if (
      !delivery ||
      delivery.status !== 'PENDING' ||
      delivery.channel !== channel
    ) {
      return null;
    }

    const subscription = delivery.subscription;
    const eligible =
      delivery.run.status === 'SUCCEEDED' &&
      delivery.run.completedAt !== null &&
      delivery.run.topic.status === 'ACTIVE' &&
      subscription.enabled &&
      subscription.canceledAt === null &&
      subscription.user.deletedAt === null &&
      (channel === 'EMAIL'
        ? subscription.emailEnabled && subscription.user.emailVerified
        : subscription.webhookEnabled &&
          Boolean(subscription.webhookUrl) &&
          Boolean(subscription.webhookSecretEncrypted));
    if (!eligible) {
      await this.markPermanentFailure(delivery.id, 'DELIVERY_NOT_ELIGIBLE');
      return null;
    }

    const claimed = await this.prisma.delivery.updateMany({
      where: {
        id: delivery.id,
        status: 'PENDING',
        attemptCount: delivery.attemptCount,
      },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    });
    if (claimed.count !== 1) return null;

    return {
      id: delivery.id,
      channel,
      subscriptionId: subscription.id,
      email: subscription.user.email,
      webhookUrl: subscription.webhookUrl,
      webhookSecretEncrypted: subscription.webhookSecretEncrypted,
      payload: {
        runId: delivery.run.id,
        completedAt: delivery.run.completedAt!,
        narrative: delivery.run.narrative,
        topic: {
          id: delivery.run.topic.id,
          slug: delivery.run.topic.slug,
          title: delivery.run.topic.title,
        },
        items: delivery.run.items,
      },
    };
  }

  async markDelivered(deliveryId: string): Promise<void> {
    const deliveredAt = new Date();
    const result = await this.prisma.delivery.updateMany({
      where: { id: deliveryId, status: 'PENDING' },
      data: {
        status: 'DELIVERED',
        deliveredAt,
        errorCode: null,
        errorMessage: null,
      },
    });
    if (result.count === 1) {
      const delivery = await this.prisma.delivery.findUnique({
        where: { id: deliveryId },
        select: { createdAt: true, channel: true, runId: true },
      });
      if (delivery) {
        this.logger.log(
          JSON.stringify({
            event: 'delivery_completed',
            deliveryId,
            runId: delivery.runId,
            channel: delivery.channel,
            status: 'DELIVERED',
            latencyMs: Math.max(
              0,
              deliveredAt.getTime() - delivery.createdAt.getTime(),
            ),
          }),
        );
      }
    }
  }

  async markPermanentFailure(deliveryId: string, code: string): Promise<void> {
    await this.prisma.delivery.updateMany({
      where: { id: deliveryId, status: 'PENDING' },
      data: { status: 'FAILED', errorCode: code, errorMessage: null },
    });
  }

  async markTransientFailure(
    deliveryId: string,
    code: string,
    terminal: boolean,
  ): Promise<void> {
    await this.prisma.delivery.updateMany({
      where: { id: deliveryId, status: 'PENDING' },
      data: {
        status: terminal ? 'FAILED' : 'PENDING',
        errorCode: code,
        errorMessage: null,
      },
    });
  }

  createUnsubscribeToken(subscriptionId: string): string {
    return this.secrets.signToken(UNSUBSCRIBE_PURPOSE, subscriptionId);
  }

  async unsubscribeEmail(token: string): Promise<void> {
    const subscriptionId = this.secrets.verifyToken(UNSUBSCRIBE_PURPOSE, token);
    if (!subscriptionId)
      throw new BadRequestException('Invalid unsubscribe token');
    await this.prisma.subscription.updateMany({
      where: { id: subscriptionId, emailEnabled: true },
      data: { emailEnabled: false },
    });
  }
}
