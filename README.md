# Anyhunt

Anyhunt 将一个 Topic 转化为持续更新的认知流。它通过 Pi Agent 自主调用 Tool/MCP 完成研究，
交付附有原始证据的聚焦 Digest，并将真实运行中验证有效的方法沉淀为可复用的标准 Skill。
Topic 持续产生内容，用户通过 Subscription 关注；同一个公开 Topic 只运行一次并共享结果。

当前实现以 Topic、Subscription、Skill、Run 和 Delivery 为产品核心，Pi 是唯一 Agent Loop。
1.0 的最终交付范围、验证证据与上线门禁见
[`docs/plans/2026-08-02-anyhunt-1.0.md`](docs/plans/2026-08-02-anyhunt-1.0.md)。

长期产品目的与边界以 [`docs/design/product-purpose.md`](docs/design/product-purpose.md) 为事实源；
Agent、Tool/MCP 与 Skill 合同见
[`docs/design/agent-and-skills.md`](docs/design/agent-and-skills.md)。

## 工作区

- `apps/server`：认证、Topic、Subscription、Run、投递、Agent Host、Tool/MCP、Skills、采集与调度
- `apps/web`：阅读、探索、收件箱与订阅管理
- `apps/admin`：产品与运营管理
- `packages/http`：共享函数式 HTTP 客户端
- `packages/model-bank`：Provider 中立的模型与推理配置元数据
- `packages/ui`：共享 UI 基础组件
- `packages/editor`：Admin 使用的 Markdown 编辑器

## 本地开发

环境要求：Node.js 22.19+、pnpm 9、Docker Desktop。

推荐先启动与生产部署方式一致的完整环境。根 `.env` 只供本地 Provider Seed 与真实 Smoke 使用，必须
保持未跟踪和仅当前用户可读：

```bash
pnpm install
cp .env.example .env
chmod 600 .env
# 在 .env 中填写 OPENAI_API_KEY、OPENAI_BASE_URL、OPENAI_MODEL
pnpm docker:up
docker compose ps
```

完整环境包含 PostgreSQL、Redis、SearXNG、Mailpit、Webhook Sink、迁移、Provider Seed、Server、Web
和 Admin：

- Web：`http://localhost:3001`
- Admin：`http://localhost:3002`
- API：`http://localhost:3000`
- Mailpit：`http://localhost:8025`
- Webhook Sink：`http://localhost:3003/requests`

`migrate` 和 `seed-provider` 成功退出属于正常状态，其余长期服务必须为 `healthy`。停止环境使用
`pnpm docker:down`。`pnpm docker:reset` 会删除本地数据库卷，只能在明确需要空库重建时执行。

需要宿主机热更新时，再分别复制应用环境清单并启动三个开发进程：

```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env
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
RUN_INTEGRATION_TESTS=1 pnpm --filter @anyhunt/server test:integration
pnpm --filter @anyhunt/web test:e2e
pnpm --filter @anyhunt/admin test:e2e
pnpm test:browser
pnpm build
pnpm audit --prod
```

真实 Provider 与 Tool/Skill/取消恢复 Smoke 必须在完整 Docker 环境中执行：

```bash
pnpm docker:smoke
```

Smoke 只记录脱敏模型、端点类型、耗时、Tool 数量和结果，禁止记录 Key、Authorization Header、完整
Prompt、Skill 正文或采集正文。Mock 只用于确定性单元测试和故障注入，不能替代真实 Smoke。

开发期间优先执行应用级命令，例如：

```bash
pnpm --filter @anyhunt/server test:unit
pnpm --filter @anyhunt/web typecheck
```

## 部署

仓库为 Server、Web 和 Admin 提供独立生产 Dockerfile；根 `compose.yml` 是本地生产相似验收环境，
`compose.production.yml` 是 Dokploy 的独立生产拓扑。生产栈自带 PostgreSQL、Redis、SearXNG、
迁移与 Provider Seed，不复用其他产品的数据库、Token 或运行时。

Dokploy 的端口、域名、环境变量、切换、备份和回滚合同见
[`docs/deployment.md`](docs/deployment.md)。启动新版本前必须先应用唯一 Prisma migration：

```bash
pnpm --filter @anyhunt/server exec prisma migrate deploy --config prisma.main.config.ts
```

部署平台必须通过密钥管理器注入认证、数据加密、邮件和外部服务凭据；Web/Admin 不接收 Provider
Key。Provider 与默认模型由一次性 Seed 加密写入数据库，后续可由 Admin 管理。Server readiness 为
`/health/ready`，liveness 为 `/health/live`。API 合同变化时，先部署 Server，再部署客户端。

## 许可

未公开授权，保留所有权利。
