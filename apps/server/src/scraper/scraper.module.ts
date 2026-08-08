// apps/server/src/scraper/scraper.module.ts
import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service';

// Handlers (Single Responsibility)
import { PageConfigHandler } from './handlers/page-config.handler';
import { WaitStrategyHandler } from './handlers/wait-strategy.handler';
import { ActionExecutorHandler } from './handlers/action-executor.handler';

// Transformers
import { MarkdownTransformer } from './transformers/markdown.transformer';
import { ReadabilityTransformer } from './transformers/readability.transformer';
import { MetadataTransformer } from './transformers/metadata.transformer';
import { LinksTransformer } from './transformers/links.transformer';

@Module({
  providers: [
    ScraperService,
    // Handlers
    PageConfigHandler,
    WaitStrategyHandler,
    ActionExecutorHandler,
    // Transformers
    MarkdownTransformer,
    ReadabilityTransformer,
    MetadataTransformer,
    LinksTransformer,
  ],
  exports: [ScraperService],
})
export class ScraperModule {}
