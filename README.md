# Anyhunt

Anyhunt 将一个主题转化为持续更新的 AI 精选摘要。它会发现信息源、收集新内容、去除重复、
筛选重要信息，并将聚焦后的每期内容投递到个人收件箱。

长期产品目的与边界以 [`docs/design/product-purpose.md`](docs/design/product-purpose.md)
为事实源。

## 工作区

- `apps/server`：认证、计费、Digest 领域、采集与调度
- `apps/web`：阅读、探索、收件箱与订阅管理
- `apps/admin`：产品与运营管理
- `packages/http`：共享函数式 HTTP 客户端
- `packages/model-bank`：Digest LLM 使用的 Provider 与推理元数据
- `packages/ui`：共享 UI 基础组件
- `packages/editor`：Admin 使用的 Markdown 编辑器

## 本地开发

环境要求：Node.js 22.19+、pnpm 9。

```bash
pnpm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env
```

启动 PostgreSQL、Redis 和已配置的采集依赖，然后在不同终端启动三个应用：

```bash
pnpm dev:server
pnpm dev:web
pnpm dev:admin
```

示例环境文件是配置项清单。真实密钥只能保存在未跟踪的本地文件或部署平台的密钥管理器中。

## 验证

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
```

开发期间优先执行应用级命令，例如：

```bash
pnpm --filter @anyhunt/server test:unit
pnpm --filter @anyhunt/web typecheck
```

## 部署

仓库为每个应用提供独立 Dockerfile，Server、Web 和 Admin 分别部署。Server 依赖
PostgreSQL 与 Redis；启动新版本前先应用 Prisma migration：

```bash
pnpm --filter @anyhunt/server exec prisma migrate deploy \
  --schema=prisma/main/schema.prisma
```

API 合同变化时，先部署 Server，再部署客户端。

## 许可

未公开授权，保留所有权利。
