# Anyhunt 生产部署

本文是 Anyhunt 在 Dokploy 的生产部署事实源。生产使用仓库根目录
`compose.production.yml`，一个 Compose 栈拥有应用和全部持久化依赖，不复用 Moryflow 的账号、
数据库、Redis、密钥或运行时。

## 拓扑与外部合同

| 服务   | 容器端口 | HOST 发布端口 | 公网入口                     |
| ------ | -------: | ------------: | ---------------------------- |
| Web    |     3000 |          3200 | `https://anyhunt.app`        |
| Server |     3000 |          3202 | `https://server.anyhunt.app` |
| Admin  |     8080 |          3203 | `https://admin.anyhunt.app`  |

PostgreSQL、Redis 和 SearXNG 只在 Compose 内部网络开放。`migrate` 与 `seed-provider` 是一次性
任务，成功退出属于正常状态。旧部署中的 Console 3201 与 Docs 3204 不属于 1.0 产品，不再部署。
公网域名由现有 HOST 端口转发提供，Dokploy 内不重复创建 Domain/Traefik 规则。

生产栈包含：

- PostgreSQL 16：产品与认证数据，使用命名卷 `postgres-data`；
- Redis 7：队列、调度、限流和临时状态，使用 AOF 命名卷 `redis-data`；
- SearXNG：Agent 内部搜索 Tool，不发布公网端口；
- Migrate：在 Server 启动前执行唯一 Prisma migration；
- Provider Seed：从部署密钥幂等写入加密 Provider、Model 和默认设置；
- Server、Web、Admin：三个公开产品进程。

SearXNG 配置在专用镜像构建时写入，避免自动部署依赖宿主机仓库路径挂载。所有镜像版本或摘要固定，
日志使用 10 MB × 5 文件轮转。实现只覆盖当前闭环，不预建多环境编排平台或额外部署抽象。

## 环境变量

Dokploy Compose 的 Environment 必须配置下列变量。值只能保存在部署平台密钥区，不得写入 Git、
日志、截图或测试快照。

| 变量                          | 必需   | 用途                                           |
| ----------------------------- | ------ | ---------------------------------------------- |
| `POSTGRES_PASSWORD`           | 是     | 独立生产数据库密码，使用 URL 安全随机值        |
| `BETTER_AUTH_SECRET`          | 是     | Better Auth 会话签名密钥，至少 32 字符         |
| `ANYHUNT_LLM_SECRET_KEY`      | 是     | 加密数据库内的 Provider Key，Base64 32 字节    |
| `ANYHUNT_DATA_SECRET_KEY`     | 是     | 加密 Webhook Secret 与签名数据，Base64 32 字节 |
| `SEARXNG_SECRET`              | 是     | SearXNG 内部密钥                               |
| `OPENAI_API_KEY`              | 是     | 仅注入一次性 Provider Seed                     |
| `OPENAI_BASE_URL`             | 是     | 仅注入一次性 Provider Seed                     |
| `OPENAI_MODEL`                | 是     | 仅注入一次性 Provider Seed                     |
| `ADMIN_EMAILS`                | 建议   | 逗号分隔的管理员邮箱                           |
| `EMAIL_FROM`                  | 是     | 发件人，例如 `Anyhunt <noreply@anyhunt.app>`   |
| `RESEND_API_KEY` / `SMTP_URL` | 二选一 | 注册 OTP、密码重置和 Email Delivery            |

`OPENAI_*` 不注入 Server、Web 或 Admin 常驻进程。Provider Seed 会使用
`ANYHUNT_LLM_SECRET_KEY` 加密凭据后写入数据库；Web/Admin 永远不接收 Provider Key。

正式开放注册前，`RESEND_API_KEY` 或 `SMTP_URL` 必须至少配置一个。未配置邮件传输时，健康检查和
公开页面仍可工作，但注册验证、密码重置和 Email Delivery 不构成可上线闭环。

## Dokploy 配置

1. 在 Anyhunt 项目的 production 环境创建一个 Docker Compose 服务，名称为
   `anyhunt-production`。
2. Source 选择 GitHub 仓库 `dvlin-dev/anyhunt`、分支 `main`，Compose Path 为
   `/compose.production.yml`，启用 On Push 自动部署。
3. 在 Environment 中注入上表变量。Compose 通过 `${VAR}` 读取；不要把密钥写入 compose 文件。
4. 首次部署前确认 3200、3202、3203 未被其他服务占用。
5. 部署后确认 `postgres`、`redis`、`searxng`、`server`、`web`、`admin` 健康，`migrate` 与
   `seed-provider` 退出码为 0。
6. 为 `postgres-data` 和 `redis-data` 配置平台卷备份；PostgreSQL 备份是恢复产品数据的事实源。

## 切换、验证与回滚

同一 HOST 端口不能由新旧服务同时占用。切换顺序固定为：

1. 先完成新 Compose 的 Source、Environment 和构建配置，但不占用正式端口；
2. 记录旧 Anyhunt 应用 ID、端口和运行状态，停止旧 Anyhunt Web/Server/Admin；
3. 部署新 Compose，确认数据库迁移和 Provider Seed 成功；
4. 验证三个公网入口、健康检查、登录、Topic 研究、Tool Call、Skill、停止/恢复与投递；
5. 新环境全部通过后，删除旧 Anyhunt Web/Console/Server/Admin/Docs；
6. 若切换失败，先停止新 Compose，再重新启动旧 Web/Server/Admin，避免双重端口占用。

最小生产验证：

```bash
curl --fail --silent --show-error https://server.anyhunt.app/health/ready
curl --fail --silent --show-error https://anyhunt.app/
curl --fail --silent --show-error https://admin.anyhunt.app/health
```

浏览器验收必须使用真实公网域名和真实 Provider，并确认页面无阻断错误。记录仅包含脱敏模型名、
端点类型、场景和结果，不记录密钥、Authorization Header、完整 Prompt、Skill 正文或采集正文。

## 更新与恢复

- 日常发布由 `main` push 触发；先观察一次性任务，再观察常驻服务健康。
- Schema 变化只能通过 Prisma migration；生产禁止 `db push`。
- 回滚代码时不得回滚已经执行的破坏性 Schema 变化；先验证 migration 的前后兼容窗口。
- 恢复数据库时停止 Server 和队列消费，恢复 PostgreSQL 后再启动 Redis、Server、Web、Admin。
- 安全密钥轮换需要明确的数据重加密方案；禁止直接替换 LLM/Data 加密密钥导致历史密文不可读。
