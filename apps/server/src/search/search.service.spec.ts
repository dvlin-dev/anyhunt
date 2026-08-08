import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScraperService } from '../scraper/scraper.service';
import { serverHttpRaw } from '../common/http/server-http-client';
import { SearchService } from './search.service';

vi.mock('../common/http/server-http-client', () => ({
  serverHttpRaw: vi.fn(),
}));

describe('SearchService', () => {
  beforeEach(() => {
    vi.mocked(serverHttpRaw).mockReset();
  });

  it('normalizes an empty SearXNG response without number_of_results', async () => {
    vi.mocked(serverHttpRaw).mockResolvedValue(
      new Response(
        JSON.stringify({
          query: 'OpenAI',
          results: [],
          suggestions: [],
          unresponsive_engines: [['duckduckgo', 'timeout']],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const service = new SearchService(
      new ConfigService({ SEARXNG_URL: 'http://searxng:8080' }),
      {} as ScraperService,
    );

    await expect(
      service.search({ query: 'OpenAI', limit: 10, scrapeResults: false }),
    ).resolves.toEqual({
      query: 'OpenAI',
      numberOfResults: 0,
      results: [],
      suggestions: [],
    });
  });
});
