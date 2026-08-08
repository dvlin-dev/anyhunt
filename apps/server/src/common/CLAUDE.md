# Common

业务无关的服务端共享基础设施。

## 职责

- 全局 Zod 请求校验与 RFC 7807 Problem 响应。
- Redis 支撑的用户级限流。
- 防 SSRF URL 校验与感知重定向的安全 Fetch。
- 共享分页、JSON、加密、Origin 与 HTTP 工具。
- 安全 Webhook 传输与终端 Not Found Controller。

## 边界

- Common 代码必须无状态或只属于基础设施作用域，不得承载产品策略。
- 不得依赖业务模块。
- 所有用户提供的出站 URL 都必须通过 DNS 感知校验；每次重定向都要重新校验，私有、保留、
  携带凭据或非 HTTP URL 必须失败关闭。
- Webhook 默认只接受 HTTPS。仅本地 Compose 验收可通过 `ANYHUNT_LOCAL_WEBHOOK_SINK_URL` 放行一个
  完全相等的内部 HTTP Sink；该路径禁止重定向，未配置时不存在例外。
- 共享错误码与 Problem Details 属于公开 API 合同；变更必须有明确意图并测试序列化结果。
- Common 不提供会员、余额或其他商业化策略；运行保护使用明确的服务级上限。
