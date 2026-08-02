# Main Prisma database

`schema.prisma` is the single PostgreSQL schema for Anyhunt accounts, billing,
Digest content and operations.

- The standalone repository starts from `20260802000000_init`.
- Never edit an applied migration; add a new migration for every later schema change.
- Generate locally with `pnpm --filter @anyhunt/server prisma:migrate:main`.
- Production applies migrations with `prisma migrate deploy --config prisma.main.config.ts`.
- `prisma:push:main` is development-only.
- CI should validate the migration chain against an empty PostgreSQL database.
