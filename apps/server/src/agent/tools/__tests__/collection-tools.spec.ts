import type { Page, Route } from 'playwright';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UrlValidator } from '../../../common/validators/url.validator';
import { installPageSsrfGuard } from '../../../common/utils/playwright-ssrf-guard';
import type { MapService } from '../../../map/map.service';
import type { ScraperService } from '../../../scraper/scraper.service';
import type { SearchService } from '../../../search/search.service';
import {
  AgentToolRegistryService,
  type RegisteredAgentToolDefinition,
} from '../agent-tool-registry.service';
import { createCrawlSiteTool } from '../crawl-site.tool';
import { createReadRssTool } from '../read-rss.tool';
import { createWebFetchTool } from '../web-fetch.tool';
import { createWebSearchTool } from '../web-search.tool';
import { EvidenceLedgerStore } from '../evidence-ledger';

function resolve(tool: RegisteredAgentToolDefinition) {
  const registry = new AgentToolRegistryService();
  registry.register(tool);
  registry.freeze();
  return registry.resolveTool(tool.name, {
    allowedPermissions: new Set([tool.permission]),
  });
}

function context() {
  return {
    runId: 'run-1',
    toolCallId: 'call-1',
    signal: new AbortController().signal,
  };
}

function ledgers() {
  const store = new EvidenceLedgerStore();
  store.create('run-1');
  return store;
}

describe('collection Tool adapters', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps web_search to the existing SearchService with bounded defaults', async () => {
    const search = vi.fn().mockResolvedValue({
      query: 'agent skills',
      numberOfResults: 1,
      results: [
        {
          title: 'Agent Skills',
          url: 'https://example.com/skills',
          description: 'A standard.',
          engine: 'example',
          publishedDate: '2026-08-01',
        },
      ],
    });
    const tool = resolve(
      createWebSearchTool(
        { search } as unknown as SearchService,
        { isAllowed: vi.fn().mockResolvedValue(true) },
        ledgers(),
      ),
    );

    const result = await tool.execute(
      { query: 'agent skills' },
      context(),
    );

    expect(search).toHaveBeenCalledWith({
      query: 'agent skills',
      limit: 10,
      safeSearch: 1,
      scrapeResults: false,
    });
    expect(result).toMatchObject({
      results: [{ url: 'https://example.com/skills', source: 'example' }],
    });
  });

  it('maps web_fetch to the existing ScraperService without exposing actions', async () => {
    const scrape = vi.fn().mockResolvedValue({
      id: 'scrape-1',
      url: 'https://example.com/article',
      fromCache: false,
      markdown: '# Article',
      metadata: {
        title: 'Article',
        canonicalUrl: 'https://example.com/canonical',
      },
    });
    const tool = resolve(
      createWebFetchTool(
        { scrape } as unknown as ScraperService,
        { isAllowed: vi.fn().mockResolvedValue(true) },
        ledgers(),
      ),
    );

    const result = await tool.execute(
      { url: 'https://example.com/article' },
      context(),
    );

    expect(scrape).toHaveBeenCalledWith({
      url: 'https://example.com/article',
      formats: ['markdown'],
      onlyMainContent: true,
      timeout: 25_000,
      mobile: false,
      darkMode: false,
    });
    expect(result).toMatchObject({
      url: 'https://example.com/canonical',
      content: '# Article',
    });
  });

  it('maps crawl_site to the existing MapService with a hard 100 URL cap', async () => {
    const map = vi.fn().mockResolvedValue({
      links: ['https://example.com/news'],
      count: 1,
    });
    const tool = resolve(
      createCrawlSiteTool(
        { map } as unknown as MapService,
        { isAllowed: vi.fn().mockResolvedValue(true) },
        ledgers(),
      ),
    );

    const result = await tool.execute(
      { url: 'https://example.com', limit: 100 },
      context(),
    );

    expect(map).toHaveBeenCalledWith({
      url: 'https://example.com',
      limit: 100,
      includeSubdomains: false,
      ignoreSitemap: false,
    });
    expect(result).toEqual({
      links: ['https://example.com/news'],
      count: 1,
    });
  });

  it('reads RSS through the shared redirect-validating fetch boundary', async () => {
    const isAllowed = vi.fn().mockResolvedValue(true);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          `<?xml version="1.0"?><rss><channel><title>Updates</title><item><title>One</title><link>https://example.com/one</link><description>Summary</description><pubDate>2026-08-01</pubDate></item></channel></rss>`,
          {
            status: 200,
            headers: { 'content-type': 'application/rss+xml' },
          },
        ),
      ),
    );
    const tool = resolve(
      createReadRssTool(
        { isAllowed } as unknown as UrlValidator,
        ledgers(),
      ),
    );

    const result = await tool.execute(
      { url: 'https://example.com/feed.xml' },
      context(),
    );

    expect(isAllowed).toHaveBeenCalledWith('https://example.com/feed.xml');
    expect(result).toMatchObject({
      title: 'Updates',
      entries: [
        {
          title: 'One',
          url: 'https://example.com/one',
          summary: 'Summary',
        },
      ],
    });
  });
});

describe('browser SSRF guard', () => {
  it('validates every HTTP request and blocks disallowed redirect targets', async () => {
    const handlers: Array<(route: Route) => Promise<void>> = [];
    const page = {
      route: vi.fn(async (_pattern, handler) => handlers.push(handler)),
      unroute: vi.fn().mockResolvedValue(undefined),
    } as unknown as Page;
    const isAllowed = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const cleanup = await installPageSsrfGuard(
      page,
      { isAllowed } as unknown as UrlValidator,
    );
    const continueRequest = vi.fn();
    const abortRequest = vi.fn();
    const route = (url: string) =>
      ({
        request: () => ({ url: () => url }),
        continue: continueRequest,
        abort: abortRequest,
      }) as unknown as Route;

    await handlers[0]!(route('https://example.com/start'));
    await handlers[0]!(route('http://127.0.0.1/redirect'));
    await cleanup();

    expect(isAllowed).toHaveBeenNthCalledWith(1, 'https://example.com/start');
    expect(isAllowed).toHaveBeenNthCalledWith(2, 'http://127.0.0.1/redirect');
    expect(continueRequest).toHaveBeenCalledTimes(1);
    expect(abortRequest).toHaveBeenCalledWith('blockedbyclient');
    expect(page.unroute).toHaveBeenCalledTimes(2);
  });
});
