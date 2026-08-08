/**
 * [INPUT]: Playwright Page and the shared UrlValidator
 * [OUTPUT]: Request interception that blocks disallowed browser network targets
 * [POS]: Shared SSRF boundary for browser-backed server capabilities
 */

import type { Page, Route } from 'playwright';
import type { UrlValidator } from '../validators/url.validator';

export async function installPageSsrfGuard(
  page: Page,
  urlValidator: UrlValidator,
): Promise<() => Promise<void>> {
  const handler = async (route: Route): Promise<void> => {
    const url = route.request().url();
    if (await urlValidator.isAllowed(url)) {
      await route.continue();
      return;
    }
    await route.abort('blockedbyclient');
  };

  await page.route('http://**/*', handler);
  await page.route('https://**/*', handler);

  return async () => {
    await page.unroute('http://**/*', handler);
    await page.unroute('https://**/*', handler);
  };
}
