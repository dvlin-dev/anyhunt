# Anyhunt

Anyhunt turns a topic into a recurring, AI-curated digest. It discovers sources,
collects new material, removes duplicates, ranks useful items, and publishes focused
editions to a personal inbox.

The long-term product purpose and boundaries are defined in
[`docs/design/product-purpose.md`](docs/design/product-purpose.md).

## Workspace

- `apps/server` — authentication, billing, Digest domain, collection and scheduling
- `apps/web` — reader, explore, inbox and subscriptions
- `apps/admin` — product and operational administration
- `packages/http` — shared functional HTTP client
- `packages/model-bank` — provider and reasoning metadata used by Digest LLMs
- `packages/ui` — shared UI primitives
- `packages/editor` — Markdown editor used by Admin

## Local development

Requirements: Node.js 22.19+ and pnpm 9.

```bash
pnpm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env
```

Start PostgreSQL, Redis, and any configured acquisition dependencies, then run the
applications in separate terminals:

```bash
pnpm dev:server
pnpm dev:web
pnpm dev:admin
```

The example environment files are the configuration inventory. Keep real secrets in
untracked local files or the deployment platform's secret manager.

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
```

Run an application-scoped command while iterating, for example:

```bash
pnpm --filter @anyhunt/server test:unit
pnpm --filter @anyhunt/web typecheck
```

## Deployment

The repository ships one Dockerfile per application. Deploy the server, web reader,
and admin independently. The server requires PostgreSQL and Redis; apply its Prisma
migrations before starting a new server version:

```bash
pnpm --filter @anyhunt/server exec prisma migrate deploy \
  --schema=prisma/main/schema.prisma
```

When an API contract changes, deploy the server before its clients.

## License

UNLICENSED. All rights reserved.
