# Anyhunt Server

Anyhunt 持续信息 Agent 产品的 NestJS 后端。

## 职责

- 会话认证、用户、Topic、Subscription、Run、Inbox 查询与 Delivery。
- Pi Agent Host、标准 Agent Skills、本地 Tool 和受控 MCP 生命周期。
- Agent 使用的搜索、RSS、站点映射、抓取与浏览器采集能力。
- Admin API、请求日志、健康检查、调度和运营队列。
- Agent 运行所需的动态 LLM Provider/模型配置。

## 边界

- 搜索、RSS、站点映射、抓取与浏览器自动化只作为 Agent Tool，不形成独立产品领域。
- Pi 是唯一 Agent Loop；Server 只实现 Provider 解析、事件适配、工具注册和生命周期管理。
- Topic 是研究与调度主体；Subscription 只保存关注关系与投递偏好。
- Anyhunt 1.0 不包含商业化、会员等级、余额或兑换领域。
- PostgreSQL 是唯一应用数据库；Redis 支撑 BullMQ 与缓存。
- 已认证产品 API 使用 Bearer Access Token；Admin API 还要求管理员账号。
- 生产 Schema 变更使用 `prisma migrate deploy`；`db push` 仅限开发环境。
- 密钥来自环境变量，禁止通过 API 返回或提交到仓库。
- 所有 Controller 使用 API 版本 `1`；用户可见错误使用英文。

## 1.0 入口

- `src/app.module.ts`：应用组合入口。
- `src/agent/`：Pi Runtime、Tool/MCP、Skills 与运行合同。
- `src/topic/`：Topic、Run、调度与共享结果。
- `src/subscription/`、`src/inbox/`、`src/delivery/`：关注、查询和外部投递。
- `src/search/`、`src/map/`、`src/scraper/`、`src/browser/`：内部采集能力。
- `src/auth/`、`src/user/`：账号与身份。
- `src/llm/`：加密 Provider 配置与 Pi 模型解析。
- `prisma/main/`：唯一数据库 Schema 与 migration 基线。

稳定架构以 `docs/design/agent-and-skills.md` 为准；安装、验证与部署入口见根 `README.md`。
