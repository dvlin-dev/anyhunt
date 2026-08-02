# Anyhunt

Anyhunt is an independent AI information subscription product. Its primary flow is
Topic -> Sources -> Scheduled collection -> Deduplication -> Digest -> Inbox.

## Boundaries

- `apps/server` owns authentication, billing, Digest, acquisition and scheduling.
- `apps/web` is the end-user reader.
- `apps/admin` is the private operations surface.
- Acquisition modules are internal product capabilities, not separate developer products.
- Do not add Moryflow workspace dependencies, Memox, vector memory, knowledge graphs,
  generic agent workflows or browser playgrounds.
- Accounts, tokens, databases and billing are owned by Anyhunt.
- Secrets belong in environment variables and must never be committed.

## Development

- Prefer root-cause refactors; do not retain deprecated compatibility layers.
- User-facing text and API errors are English.
- New architecture decisions go in `docs/`; keep source headers factual and timeless.
- Run the smallest relevant checks first, then the root confidence suite before merge.
