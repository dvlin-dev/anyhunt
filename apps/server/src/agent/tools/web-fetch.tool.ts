/**
 * [INPUT]: Agent URL fetch request
 * [OUTPUT]: Main page content and normalized metadata
 * [POS]: Thin Tool adapter over the existing browser-backed ScraperService
 */

import { z } from 'zod';
import type { UrlValidator } from '../../common/validators/url.validator';
import type { ScraperService } from '../../scraper/scraper.service';
import type { RegisteredAgentToolDefinition } from './agent-tool-registry.service';
import {
  recordPublicEvidence,
  type EvidenceLedgerStore,
} from './evidence-ledger';

const WebFetchInputSchema = z.object({
  url: z.url({ protocol: /^https?$/ }),
});

type WebFetchInput = z.infer<typeof WebFetchInputSchema>;

export function createWebFetchTool(
  scraperService: Pick<ScraperService, 'scrape'>,
  urlValidator: Pick<UrlValidator, 'isAllowed'>,
  evidenceLedgers: EvidenceLedgerStore,
): RegisteredAgentToolDefinition<WebFetchInput, unknown> {
  return {
    name: 'web_fetch',
    description:
      'Fetch a public web page and return its main readable content and metadata.',
    inputSchema: WebFetchInputSchema,
    permission: 'network.read',
    timeoutMs: 30_000,
    maxResultChars: 60_000,
    execute: async ({ url }, context) => {
      const result = await scraperService.scrape({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 25_000,
        mobile: false,
        darkMode: false,
      });
      const canonicalUrl = result.metadata?.canonicalUrl;
      const outputUrl =
        canonicalUrl && (await urlValidator.isAllowed(canonicalUrl))
          ? canonicalUrl
          : result.url;
      const output = {
        url: outputUrl,
        requestedUrl: url,
        title: result.metadata?.title ?? result.metadata?.ogTitle,
        description:
          result.metadata?.description ?? result.metadata?.ogDescription,
        publishedAt: result.metadata?.publishedTime,
        content: result.markdown ?? '',
      };
      const recorded = await recordPublicEvidence(
        evidenceLedgers.get(context.runId),
        urlValidator,
        {
          url: output.url,
          title: output.title,
          content: output.content,
          toolName: 'web_fetch',
        },
      );
      if (!recorded) throw new Error('Fetched page URL is not public');
      return output;
    },
  };
}
