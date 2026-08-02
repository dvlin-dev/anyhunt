# Anyhunt Admin

Anyhunt 持续信息 Agent 产品的内部运营应用。

## 职责

- 管理用户、Topic、Subscription、公开内容举报与下架。
- 配置加密存储的 LLM Provider、模型、默认 Agent 模型和服务端 MCP。
- 诊断 Run、Tool、Skill、Delivery、队列、请求日志与产品健康度。

## 合同

- 所有应用路由都要求管理员会话。
- 服务端状态通过 `src/features` 下的函数式 API 模块接入 TanStack Query。
- 共享展示基础组件来自 `@anyhunt/ui`。
- 用户可见文案使用英文；运营术语可以沿用服务端领域名称。
- Admin 不承载 Billing、Quota、Payment、Credits、会员等级或 Redemption 产品面。
