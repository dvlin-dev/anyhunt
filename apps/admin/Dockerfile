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
ARG VITE_AUTH_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AUTH_URL=$VITE_AUTH_URL
RUN pnpm --filter "@anyhunt/admin^..." --if-present build \
  && pnpm --filter @anyhunt/admin build

FROM nginxinc/nginx-unprivileged:1.27.4-alpine@sha256:62a904036bfc0e4a4f2b556e34cbf17bc136b47fde8cdb4628762725f48c5782 AS runner

COPY --chown=101:101 apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder --chown=101:101 /workspace/apps/admin/dist /usr/share/nginx/html
USER 101

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
