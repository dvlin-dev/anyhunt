# Architecture

Anyhunt has one product loop:

`Topic -> acquisition -> deduplication -> ranking -> Digest edition -> inbox`

## Applications

- `apps/web` owns the end-user reader and subscription experience.
- `apps/server` owns authentication, billing, schedules, acquisition and Digest data.
- `apps/admin` owns private product operations.

## Server boundaries

The Digest domain orchestrates search, scraping and mapping through internal service
interfaces. Those acquisition capabilities are implementation details, not public
developer products. The server has one PostgreSQL schema and Redis-backed queues; it
does not use a vector database, knowledge graph, generic agent kernel or external
workspace runtime.

Provider-neutral model metadata lives in `packages/model-bank`. Digest LLM calls use
the AI SDK through server-owned configuration. Credentials never enter client bundles
or persisted content.

## Product isolation

Anyhunt owns its accounts, tokens, database, billing and deployments. Other products
may integrate only through an explicitly designed HTTP API. They do not import this
workspace's source packages or share its persistence layer.
