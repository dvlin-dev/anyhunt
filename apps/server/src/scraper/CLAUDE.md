# Scraper

Internal browser-based acquisition engine for turning a URL into structured content.

## Responsibilities

- Render pages through the shared Playwright pool.
- Extract readable Markdown, HTML, links, metadata, screenshots, and PDFs.
- Apply page configuration, wait strategies, and bounded browser actions.
- Cache reusable results and execute asynchronous work through BullMQ.

## Constraints

- Validate every target with the shared SSRF guard; the browser pool also blocks unsafe
  subrequests.
- Browser concurrency and page limits are configuration, and every failure path must
  release pages and queue resources.
- Bill before metered acquisition. Cache hits are free, and failed queued work refunds
  the persisted quota breakdown idempotently.
- `scrapeSync()` is the internal synchronous composition API for acquisition services.
- Request headers are runtime-only and must not be persisted in job options.
- Queue event connections used for synchronous waiting must close during shutdown.
