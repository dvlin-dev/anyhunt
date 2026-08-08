/**
 * [INPUT]: Agent site discovery request
 * [OUTPUT]: Bounded same-site URL list
 * [POS]: Thin Tool adapter over the existing MapService
 */

import { z } from 'zod';
import type { UrlValidator } from '../../common/validators/url.validator';
import type { MapService } from '../../map/map.service';
import type { RegisteredAgentToolDefinition } from './agent-tool-registry.service';
import {
  recordPublicEvidence,
  type EvidenceLedgerStore,
} from './evidence-ledger';

const CrawlSiteInputSchema = z.object({
  url: z.url({ protocol: /^https?$/ }),
  search: z.string().trim().min(1).max(200).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  includeSubdomains: z.boolean().default(false),
});

type CrawlSiteInput = z.infer<typeof CrawlSiteInputSchema>;

export function createCrawlSiteTool(
  mapService: Pick<MapService, 'map'>,
  urlValidator: Pick<UrlValidator, 'isAllowed'>,
  evidenceLedgers: EvidenceLedgerStore,
): RegisteredAgentToolDefinition<CrawlSiteInput, unknown> {
  return {
    name: 'crawl_site',
    description:
      'Discover public URLs from a site sitemap and a bounded browser crawl.',
    inputSchema: CrawlSiteInputSchema,
    permission: 'network.read',
    timeoutMs: 45_000,
    maxResultChars: 30_000,
    execute: async (input, context) => {
      const result = await mapService.map({
        ...input,
        ignoreSitemap: false,
      });
      const ledger = evidenceLedgers.get(context.runId);
      const allowed = await Promise.all(
        result.links.map((url) => urlValidator.isAllowed(url)),
      );
      const links = result.links.filter((_url, index) => allowed[index]);
      for (const url of links) {
        await recordPublicEvidence(ledger, urlValidator, {
          url,
          content: url,
          toolName: 'crawl_site',
        });
      }
      return { ...result, links, count: links.length };
    },
  };
}
