# Admin Features

Feature modules adapt admin API contracts into typed TanStack Query operations.

## Contracts

- Keep API calls in `api.ts`, query and mutation hooks in `hooks.ts`, and feature-owned
  DTOs in `types.ts` or `schemas.ts`.
- Query keys are feature-scoped and stable; invalidate the narrowest affected key after
  mutations.
- Poll only operational views that need freshness, with an explicit interval.
- Pages consume feature exports instead of calling the shared HTTP client directly.
- Shared transport, authentication, and error normalization remain in `src/lib`.

The active feature groups cover product operations, accounts and billing, queues and
jobs, request logs, Digest configuration and reports, and LLM configuration.
