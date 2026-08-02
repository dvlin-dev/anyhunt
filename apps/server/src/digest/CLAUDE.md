# Digest

Digest is the core product domain: subscriptions schedule acquisition runs, runs
select and summarize material, editions preserve evidence, and delivery creates the
reader inbox.

## Ownership

- Topics, sources, subscriptions, runs, editions, items, inbox state, feedback, reports,
  welcome content, and delivery.
- Authenticated reader APIs, public topic and edition APIs, and Digest-specific admin
  APIs, all under API version `1`.
- Scheduling and execution queues for source refresh, subscription runs, email, and
  webhooks.

## Contracts

- List APIs use `page` and `limit` and return:

```ts
type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
```

- Scheduler jobs and run jobs must be idempotent; Redis locks prevent duplicate
  scheduling, while persisted run state is authoritative.
- Canonical URLs and content fingerprints drive deduplication before ranking.
- RSS, crawl, and webhook URLs use the shared SSRF guard, including redirects.
- Invalid webhook destinations are unrecoverable; transient delivery failures remain
  retryable.
- Subscription limits derive from active subscriptions only.
- All LLM calls resolve the admin-configured Digest model through `src/llm`; never
  hard-code provider credentials or model IDs in this domain.
- `ANYHUNT_WWW_URL` is the canonical base for reader and unsubscribe links.
