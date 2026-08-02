# Deployment

Anyhunt deploys as three independent applications:

- `apps/server`: Node.js service with PostgreSQL and Redis.
- `apps/web`: TanStack Start Node server.
- `apps/admin`: static Vite application served by nginx or equivalent hosting.

Use each application's `.env.example` as the configuration inventory. Store production
values in the deployment platform's secret manager; never create a committed `.env`.

Before deployment run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
```

Apply `apps/server/prisma/main/migrations` to the target database before starting a new
server version. Roll out the server before clients when an API contract changes.
