# Anyhunt

Anyhunt turns a topic into a recurring, AI-curated digest. It discovers sources,
collects new material, removes duplicates, ranks useful items, and publishes a
focused inbox and edition for each subscription.

## Workspace

- `apps/server` — authentication, billing, Digest domain, collection and scheduling
- `apps/web` — reader, explore, inbox and subscriptions
- `apps/admin` — product and operational administration
- `packages/http` — shared functional HTTP client
- `packages/model-bank` — provider and reasoning metadata used by Digest LLMs
- `packages/ui` — shared UI primitives
- `packages/editor` — Markdown editor used by Admin

## Development

Requirements: Node.js 22.19+ and pnpm 9.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
```

Environment variables are documented in each application's `.env.example`. Never
commit local `.env` files.

Architecture and deployment boundaries are documented in
[`docs/architecture.md`](docs/architecture.md) and
[`docs/deployment.md`](docs/deployment.md).

## License

UNLICENSED. All rights reserved.
