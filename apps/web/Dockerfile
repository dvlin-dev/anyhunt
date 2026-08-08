FROM node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94 AS builder

RUN corepack enable && corepack prepare pnpm@9.12.2 --activate
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/editor/package.json ./packages/editor/package.json
COPY packages/http/package.json ./packages/http/package.json
COPY packages/model-bank/package.json ./packages/model-bank/package.json
COPY packages/ui/package.json ./packages/ui/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
ARG VITE_API_URL=https://server.anyhunt.app
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter "@anyhunt/web^..." --if-present build \
  && pnpm --filter @anyhunt/web build

FROM node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94 AS runner

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app
COPY --from=builder --chown=node:node /workspace/apps/web/.output ./
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server/index.mjs"]
