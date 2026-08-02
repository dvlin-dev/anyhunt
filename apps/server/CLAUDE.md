# Anyhunt Server

Anyhunt Digest 产品的 NestJS 后端。

## 职责

- 会话认证、用户、订阅、配额与支付。
- 主题、信息源发现、定时采集、排序、Digest 与收件箱。
- Digest Worker 使用的内部搜索、站点映射与抓取能力。
- Admin API、请求日志、健康检查与运营队列。
- Digest 生成所需的动态 LLM Provider/模型配置。

## 边界

- 搜索、站点映射、抓取与浏览器自动化是由 Digest 领域编排的内部采集服务。
- PostgreSQL 是唯一应用数据库；Redis 支撑 BullMQ 与缓存。
- 已认证产品 API 使用 Bearer Access Token；Admin API 还要求管理员账号。
- 生产 Schema 变更使用 `prisma migrate deploy`；`db push` 仅限开发环境。
- 密钥来自环境变量，禁止通过 API 返回或提交到仓库。
- 所有 Controller 使用 API 版本 `1`；用户可见错误使用英文。

## 入口

- `src/app.module.ts`：应用组合入口。
- `src/digest/`：产品领域与 Worker。
- `src/search/`、`src/map/`、`src/scraper/`、`src/browser/`：内部采集。
- `src/auth/`、`src/user/`、`src/quota/`、`src/billing/`、`src/payment/`：账号与计费。
- `src/llm/`：加密 Provider 配置与 AI SDK 模型构造。
- `prisma/main/`：唯一数据库 Schema 与 migration 基线。
