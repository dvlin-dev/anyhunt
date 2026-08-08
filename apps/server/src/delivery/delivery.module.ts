import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { EmailDeliveryProcessor } from './email-delivery.processor';
import { WebhookDeliveryProcessor } from './webhook-delivery.processor';

@Module({
  imports: [QueueModule],
  controllers: [DeliveryController],
  providers: [
    DeliveryService,
    EmailDeliveryProcessor,
    WebhookDeliveryProcessor,
  ],
  exports: [DeliveryService],
})
export class DeliveryModule {}
