# Anyhunt

Anyhunt is an independent AI information subscription product. Its core loop is
Topic -> acquisition -> deduplication -> ranking -> Digest -> inbox.

## Boundaries

- `apps/server` owns authentication, billing, Digest, acquisition and scheduling.
- `apps/web` is the end-user reader.
- `apps/admin` is the private operations surface.
- Acquisition modules are internal product capabilities, not separate products.
- Accounts, tokens, databases and billing are owned by Anyhunt.
- Cross-product integration requires an explicit HTTP contract; never share source
  packages or persistence across product repositories.
- Secrets belong in environment variables and must never be committed.

## Knowledge base

- `docs/design/product-purpose.md` is the only product-purpose fact source.
- `docs/index.md` is navigation only. Git history is the archive.
- `README.md` owns setup, validation, and deployment entry points.
- A directory `CLAUDE.md` records only stable responsibilities, boundaries, contracts,
  and invariants; `AGENTS.md` is a symlink to it.
- Create a directory collaboration file only when that directory scope contains more
  than ten files.
- Plans are temporary. Absorb durable facts into the knowledge base and remove the plan
  before merging.
- Do not store dates, PR status, migration history, or progress logs in collaboration
  files or source headers.

## Engineering

- Prefer root-cause refactors; do not retain deprecated compatibility layers.
- User-facing text and API errors are English.
- Use Zustand stores with methods and functional API clients for client state and requests.
- Keep TanStack Start routers request-scoped during SSR and avoid multiple React instances.
- Production schema changes use Prisma migrations; `db push` is development-only.
- Run the smallest relevant checks first, then the root confidence suite before merge.
