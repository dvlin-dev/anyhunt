# Anyhunt Server

NestJS backend for the Anyhunt Digest product.

## Responsibilities

- Session authentication, users, subscriptions, quota and payment.
- Topics, source discovery, scheduled collection, ranking, digests and inbox.
- Internal search, map and scrape acquisition used by Digest workers.
- Admin APIs, request logs, health checks and operational queues.
- Dynamic LLM provider/model configuration for Digest generation.

## Boundaries

- Acquisition is internal; this service does not expose Fetchx, Memox, API-key
  developer products, generic agents or browser sessions.
- PostgreSQL is the only application database. Redis backs BullMQ and caching.
- Public product APIs use user sessions. Admin APIs require an admin session.
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
