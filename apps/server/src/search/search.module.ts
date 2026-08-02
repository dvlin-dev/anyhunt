// apps/server/src/search/search.module.ts
import { Module } from '@nestjs/common';
import { ScraperModule } from '../scraper';
import { BillingModule } from '../billing/billing.module';

import { SearchService } from './search.service';

@Module({
  imports: [ScraperModule, BillingModule],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
