FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.12.2 --activate
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile --ignore-scripts \
  && pnpm --filter @anyhunt/server build \
  && pnpm --filter @anyhunt/server deploy --prod /opt/anyhunt-server

FROM node:22-slim AS runner

ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation fonts-noto-cjk libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libcairo2 libcups2 libdrm2 libgbm1 libnss3 libnspr4 \
    libpango-1.0-0 libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 \
    libxrandr2 openssl wget \
  && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --create-home anyhunt

WORKDIR /app
COPY --from=builder --chown=anyhunt:nodejs /opt/anyhunt-server ./
RUN chmod +x docker-entrypoint.sh
USER anyhunt
RUN npx playwright install chromium

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/live || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
