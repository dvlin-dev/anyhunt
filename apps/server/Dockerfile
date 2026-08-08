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
# Prisma 7 的驱动适配器客户端由内置 WASM 解析器生成；旧 schema engine 仅供迁移命令使用。
RUN pnpm --filter "@anyhunt/server^..." --if-present build \
  && PRISMA_SCHEMA_ENGINE_BINARY=/usr/bin/true pnpm --filter @anyhunt/server build \
  && pnpm --filter @anyhunt/server deploy --prod /opt/anyhunt-server

FROM node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94 AS runner

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation fonts-noto-cjk libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libcairo2 libcups2 libdrm2 libgbm1 libnss3 libnspr4 \
    libpango-1.0-0 libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 \
    libxrandr2 openssl wget \
  && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --create-home anyhunt
RUN npx --yes playwright@1.62.1 install chromium \
  && rm -rf /root/.npm

WORKDIR /app
COPY --from=builder --chown=anyhunt:nodejs /opt/anyhunt-server ./
RUN chmod +x docker-entrypoint.sh
USER anyhunt

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health/ready || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
