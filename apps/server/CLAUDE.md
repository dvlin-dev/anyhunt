# Anyhunt Server

NestJS backend for the Anyhunt Digest product.

## Responsibilities

- Session authentication, users, subscriptions, quota and payment.
- Topics, source discovery, scheduled collection, ranking, digests and inbox.
- Internal search, map and scrape acquisition used by Digest workers.
- Admin APIs, request logs, health checks and operational queues.
- Dynamic LLM provider/model configuration for Digest generation.

## Boundaries

- Search, site mapping, scraping, and browser automation are internal acquisition
  services composed by the Digest domain.
- PostgreSQL is the only application database. Redis backs BullMQ and caching.
- Authenticated product APIs use bearer access tokens. Admin APIs additionally require
  an admin account.
- Production schema changes use `prisma migrate deploy`; `db push` is development-only.
- Secrets are environment variables and must never be returned by APIs or committed.
- All controllers use API version `1`; user-facing errors are English.

## Entrypoints

- `src/app.module.ts` — application composition.
- `src/digest/` — product domain and workers.
- `src/search/`, `src/map/`, `src/scraper/`, `src/browser/` — internal acquisition.
- `src/auth/`, `src/user/`, `src/quota/`, `src/billing/`, `src/payment/` — account and billing.
- `src/llm/` — encrypted provider configuration and AI SDK model construction.
- `prisma/main/` — the single database schema and migration baseline.
