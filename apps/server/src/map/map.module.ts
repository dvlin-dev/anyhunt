// apps/server/src/map/map.module.ts
import { Module } from '@nestjs/common';
import { MapService } from './map.service';
import { SitemapParser } from './sitemap-parser';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  providers: [MapService, SitemapParser],
  exports: [MapService],
})
export class MapModule {}
