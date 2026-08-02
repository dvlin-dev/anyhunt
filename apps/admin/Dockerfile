FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.12.2 --activate
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile --ignore-scripts

ARG VITE_API_URL=https://server.anyhunt.app
ARG VITE_AUTH_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AUTH_URL=$VITE_AUTH_URL
RUN pnpm --filter @anyhunt/admin build

FROM nginx:1.27-alpine AS runner

COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/apps/admin/dist /usr/share/nginx/html
RUN apk add --no-cache curl

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
