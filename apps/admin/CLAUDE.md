# Anyhunt Admin

Private operations application for the Anyhunt Digest product.

## Responsibilities

- Manage users, topics, subscriptions, queues, logs, billing, and redemption codes.
- Configure encrypted LLM providers, models and the default Digest model.
- Inspect Digest operations and product health.

## Contracts

- All application routes require an admin session.
- Server state uses TanStack Query through functional API modules under `src/features`.
- Shared presentation primitives come from `@anyhunt/ui`.
- User-facing text is English; operational terminology may follow server domain names.
