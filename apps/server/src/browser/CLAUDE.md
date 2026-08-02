# Browser

Internal Playwright browser pool used by the Digest scraper.

## Responsibilities

- Own a bounded pool of Chromium processes and pages.
- Apply launch, locale and stealth defaults needed for reliable collection.
- Recycle unhealthy or overused browser processes.

## Boundaries

- No public browser-session API, CDP gateway, agent port or playground.
- Callers depend on `BrowserPool`, not Playwright lifecycle details.
- Pool size, idle timeout and page limits are environment configuration.
- Browser failures must release resources and remain retryable by the scrape queue.
