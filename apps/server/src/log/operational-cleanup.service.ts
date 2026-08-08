/**
 * [INPUT]: Scheduled retention run and current time
 * [OUTPUT]: Bounded deletion/clearing of expired operational records
 * [POS]: Lifecycle owner for checkpoints, idempotency records, and terminal deliveries
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '../../generated/prisma-main/client';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1_000;
const FAILED_CHECKPOINT_RETENTION_DAYS = 7;
const TERMINAL_DELIVERY_RETENTION_DAYS = 30;
const OPERATIONAL_CLEANUP_CRON = '30 3 * * *';

@Injectable()
export class OperationalCleanupService {
  private readonly logger = new Logger(OperationalCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(OPERATIONAL_CLEANUP_CRON)
  async cleanup(now = new Date()): Promise<{
    checkpoints: number;
    idempotencyRecords: number;
    deliveries: number;
  }> {
    const checkpointCutoff = new Date(
      now.getTime() - FAILED_CHECKPOINT_RETENTION_DAYS * DAY_MS,
    );
    const deliveryCutoff = new Date(
      now.getTime() - TERMINAL_DELIVERY_RETENTION_DAYS * DAY_MS,
    );
    const [checkpoints, idempotencyRecords, deliveries] = await Promise.all([
      this.prisma.run.updateMany({
        where: {
          status: { in: ['FAILED', 'CANCELED'] },
          checkpoint: { not: Prisma.DbNull },
          updatedAt: { lt: checkpointCutoff },
        },
        data: { checkpoint: Prisma.DbNull },
      }),
      this.prisma.idempotencyRecord.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      this.prisma.delivery.deleteMany({
        where: {
          status: { in: ['DELIVERED', 'FAILED'] },
          updatedAt: { lt: deliveryCutoff },
        },
      }),
    ]);
    const result = {
      checkpoints: checkpoints.count,
      idempotencyRecords: idempotencyRecords.count,
      deliveries: deliveries.count,
    };
    this.logger.log(
      JSON.stringify({ event: 'operational_cleanup', ...result }),
    );
    return result;
  }
}
