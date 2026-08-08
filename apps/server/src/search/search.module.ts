// apps/server/src/search/search.module.ts
import { Module } from '@nestjs/common';
import { ScraperModule } from '../scraper';

import { SearchService } from './search.service';

@Module({
  imports: [ScraperModule],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
