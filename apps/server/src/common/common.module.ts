// apps/server/src/common/common.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UrlValidator } from './validators/url.validator';
import { WebhookService } from './services/webhook.service';
import { DataSecretService } from './services/data-secret.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [UrlValidator, WebhookService, DataSecretService],
  exports: [UrlValidator, WebhookService, DataSecretService],
})
export class CommonModule {}
