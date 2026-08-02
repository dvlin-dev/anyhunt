# Anyhunt Web

End-user TanStack Start application for discovering topics, managing subscriptions
and reading the personal Digest inbox.

## Boundaries

- Product navigation is Explore, Topics and the signed-in inbox/account surfaces.
- Server state uses TanStack Query; shared client state uses Zustand.
- Create a new router for every SSR request and keep Nitro React dependencies unified.
- User-facing copy is English and UI primitives come from `@anyhunt/ui`.
