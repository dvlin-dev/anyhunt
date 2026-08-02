# Admin 功能模块

功能模块将 Admin API 合同适配为带类型的 TanStack Query 操作。

## 合同

- API 调用放在 `api.ts`，Query/Mutation Hook 放在 `hooks.ts`，功能自有 DTO 放在
  `types.ts` 或 `schemas.ts`。
- Query Key 按功能划分且保持稳定；Mutation 后只失效最小受影响范围。
- 仅对确实要求时效性的运营视图轮询，并显式声明间隔。
- 页面消费功能模块导出，不直接调用共享 HTTP 客户端。
- 共享传输、认证与错误标准化保留在 `src/lib`。

当前功能组覆盖产品运营、账号与计费、队列与任务、请求日志、Digest 配置与举报，以及
LLM 配置。
