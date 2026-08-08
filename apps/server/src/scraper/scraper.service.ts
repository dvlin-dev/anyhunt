/**
 * [INPUT]: ScrapeOptions - URL、输出格式、等待策略与受控页面动作
 * [OUTPUT]: ScrapeResult - 页面文本、链接与元数据
 * [POS]: 无用户、计费和持久化耦合的内部 Agent 抓取能力
 */

import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Page } from 'playwright';
import { BrowserPool } from '../browser/browser-pool';
import { UrlValidator } from '../common/validators/url.validator';
import { installPageSsrfGuard } from '../common/utils/playwright-ssrf-guard';
import type { ScrapeFormat, ScrapeOptions } from './dto/scrape.dto';
import { ActionExecutorHandler } from './handlers/action-executor.handler';
import { PageConfigHandler } from './handlers/page-config.handler';
import { WaitStrategyHandler } from './handlers/wait-strategy.handler';
import type { ScrapeResult } from './scraper.types';
import { LinksTransformer } from './transformers/links.transformer';
import { MarkdownTransformer } from './transformers/markdown.transformer';
import { MetadataTransformer } from './transformers/metadata.transformer';
import { ReadabilityTransformer } from './transformers/readability.transformer';

@Injectable()
export class ScraperService {
  constructor(
    private readonly browserPool: BrowserPool,
    private readonly urlValidator: UrlValidator,
    private readonly pageConfigHandler: PageConfigHandler,
    private readonly waitStrategyHandler: WaitStrategyHandler,
    private readonly actionExecutorHandler: ActionExecutorHandler,
    private readonly markdownTransformer: MarkdownTransformer,
    private readonly readabilityTransformer: ReadabilityTransformer,
    private readonly metadataTransformer: MetadataTransformer,
    private readonly linksTransformer: LinksTransformer,
  ) {}

  async scrape(options: ScrapeOptions): Promise<ScrapeResult> {
    if (!(await this.urlValidator.isAllowed(options.url))) {
      throw new ForbiddenException('URL is not allowed (SSRF protection)');
    }

    const id = randomUUID();
    const startedAt = Date.now();
    const context = await this.browserPool.acquireContext();
    const page = await context.newPage();
    const removeSsrfGuard = await installPageSsrfGuard(page, this.urlValidator);

    try {
      await this.pageConfigHandler.configure(page, options);

      const fetchStartedAt = Date.now();
      await page.goto(options.url, {
        waitUntil: 'domcontentloaded',
        timeout: options.timeout,
      });
      const fetchMs = Date.now() - fetchStartedAt;

      if (options.actions?.length) {
        await this.actionExecutorHandler.execute(page, options.actions);
      }

      const renderStartedAt = Date.now();
      await this.waitStrategyHandler.waitForPageReady(page, options);
      const renderMs = Date.now() - renderStartedAt;

      const formats = options.formats ?? (['markdown'] as ScrapeFormat[]);
      const rawHtml = await page.content();
      const transformStartedAt = Date.now();
      const content = await this.transformContent(
        page,
        rawHtml,
        options.url,
        options,
        formats,
      );
      const transformMs = Date.now() - transformStartedAt;

      return {
        id,
        url: options.url,
        fromCache: false,
        ...content,
        timings: {
          queueWaitMs: 0,
          fetchMs,
          renderMs,
          transformMs,
          totalMs: Date.now() - startedAt,
        },
      };
    } finally {
      await removeSsrfGuard().catch(() => undefined);
      await page.close().catch(() => undefined);
      await this.browserPool.releaseContext(context);
    }
  }

  private async transformContent(
    page: Page,
    rawHtml: string,
    url: string,
    options: ScrapeOptions,
    formats: ScrapeFormat[],
  ): Promise<Partial<ScrapeResult>> {
    const processedHtml = options.onlyMainContent
      ? this.readabilityTransformer.extract(rawHtml, url, {
          includeTags: options.includeTags,
          excludeTags: options.excludeTags,
          baseUrl: url,
        })
      : rawHtml;

    return {
      rawHtml: formats.includes('rawHtml') ? rawHtml : undefined,
      html: formats.includes('html') ? processedHtml : undefined,
      markdown: formats.includes('markdown')
        ? this.markdownTransformer.convert(processedHtml, { baseUrl: url })
        : undefined,
      links: formats.includes('links')
        ? await this.linksTransformer.extract(page, url)
        : undefined,
      metadata: this.metadataTransformer.extract(rawHtml, url),
    };
  }
}
