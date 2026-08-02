# Digest

Digest 是核心产品领域：订阅负责调度采集 Run，Run 筛选并总结内容，Edition 保留证据，
投递形成阅读端收件箱。

## 职责

- Topic、Source、Subscription、Run、Edition、Item、收件箱状态、反馈、举报、欢迎内容与投递。
- 已认证阅读端 API、公开 Topic/Edition API 与 Digest 专属 Admin API，统一使用 API 版本 `1`。
- Source 刷新、Subscription Run、邮件与 Webhook 的调度和执行队列。

## 合同

- 列表 API 使用 `page` 与 `limit`，返回：

```ts
type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
```

- Scheduler Job 与 Run Job 必须幂等；Redis 锁避免重复调度，持久化 Run 状态是权威事实。
- 排序前通过规范 URL 与内容指纹去重。
- RSS、爬取与 Webhook URL 统一使用共享 SSRF Guard，包括每次重定向。
- 无效 Webhook 目标不可恢复；临时投递失败允许重试。
- 订阅限制只根据有效订阅计算。
- 所有 LLM 调用都通过 `src/llm` 解析 Admin 配置的 Digest 模型；本领域禁止硬编码
  Provider 凭据或模型 ID。
- `ANYHUNT_WWW_URL` 是阅读链接与退订链接的规范 Base URL。
