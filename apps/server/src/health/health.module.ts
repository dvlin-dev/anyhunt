import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma';
import { RedisModule } from '../redis';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, RedisModule, QueueModule],
  controllers: [HealthController],
})
export class HealthModule {}
