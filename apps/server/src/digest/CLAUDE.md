# 旧 Digest Runtime

本目录承载现有固定 Digest 流水线，只作为 Topic/Pi 架构迁移的事实输入，不再新增产品能力、
领域模型或兼容层。目标领域拆分为 `agent`、`topic`、`subscription`、`inbox` 和 `delivery`，
删除路径以 `docs/plans/2026-08-02-anyhunt-1.0.md` 为准。

## 迁移边界

- Source、Edition、Content、Score、Feedback Pattern 和固定 AI Pipeline 不进入目标架构。
- 旧数据必须经过可重复 dry-run、数量核对和可恢复备份后迁移，禁止静默丢弃。
- 旧公开 Edition URL 可以保留，但后端实体改为成功 Run。
- 旧队列生产者停止且队列清空后，才能删除模型与消费者。

## 删除前必须保持的合同

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
- RSS、爬取与 Webhook URL 统一使用共享 SSRF Guard，包括每次重定向。
- 无效 Webhook 目标不可恢复；临时投递失败允许重试。
- 本领域禁止硬编码 Provider 凭据或模型 ID。
- `ANYHUNT_WWW_URL` 是阅读链接与退订链接的规范 Base URL。
