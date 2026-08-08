/**
 * [INPUT]: Agent web search request
 * [OUTPUT]: Normalized public search results
 * [POS]: Thin Tool adapter over the existing SearchService
 */

import { z } from 'zod';
import type { UrlValidator } from '../../common/validators/url.validator';
import type { SearchService } from '../../search/search.service';
import type { RegisteredAgentToolDefinition } from './agent-tool-registry.service';
import {
  recordPublicEvidence,
  type EvidenceLedgerStore,
} from './evidence-ledger';

const WebSearchInputSchema = z.object({
  query: z.string().trim().min(1).max(500),
  limit: z.number().int().min(1).max(10).default(10),
  language: z.string().trim().min(2).max(20).optional(),
  timeRange: z.enum(['day', 'week', 'month', 'year']).optional(),
});

type WebSearchInput = z.infer<typeof WebSearchInputSchema>;

export function createWebSearchTool(
  searchService: Pick<SearchService, 'search'>,
  urlValidator: Pick<UrlValidator, 'isAllowed'>,
  evidenceLedgers: EvidenceLedgerStore,
): RegisteredAgentToolDefinition<WebSearchInput, unknown> {
  return {
    name: 'web_search',
    description:
      'Search the public web and return titles, URLs, descriptions, and publication dates.',
    inputSchema: WebSearchInputSchema,
    permission: 'network.read',
    timeoutMs: 20_000,
    maxResultChars: 40_000,
    execute: async (input, context) => {
      const response = await searchService.search({
        ...input,
        safeSearch: 1,
        scrapeResults: false,
      });
      const candidates = response.results.map((result) => ({
        title: result.title,
        url: result.url,
        description: result.description,
        publishedAt: result.publishedDate,
        source: result.engine,
      }));
      const ledger = evidenceLedgers.get(context.runId);
      const allowed = await Promise.all(
        candidates.map((result) => urlValidator.isAllowed(result.url)),
      );
      const results = candidates.filter((_result, index) => allowed[index]);
      for (const result of results) {
        await recordPublicEvidence(ledger, urlValidator, {
          url: result.url,
          title: result.title,
          content: result.description,
          toolName: 'web_search',
        });
      }
      return {
        query: response.query,
        results,
      };
    },
  };
}
