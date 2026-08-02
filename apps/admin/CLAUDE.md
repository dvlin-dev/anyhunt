# Anyhunt Admin

Private operations application for the Anyhunt Digest product.

## Responsibilities

- Manage users, topics, sources, queues, logs, billing and redemption codes.
- Configure encrypted LLM providers, models and the default Digest model.
- Inspect Digest operations without exposing internal acquisition as a product.

All routes require an admin session. Shared UI comes from `@anyhunt/ui`; data access
uses functional API clients and TanStack Query.
