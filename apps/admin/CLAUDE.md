# Anyhunt Admin

Anyhunt Digest 产品的内部运营应用。

## 职责

- 管理用户、主题、订阅、队列、日志、计费与兑换码。
- 配置加密存储的 LLM Provider、模型和默认 Digest 模型。
- 检查 Digest 运行状态与产品健康度。

## 合同

- 所有应用路由都要求管理员会话。
- 服务端状态通过 `src/features` 下的函数式 API 模块接入 TanStack Query。
- 共享展示基础组件来自 `@anyhunt/ui`。
- 用户可见文案使用英文；运营术语可以沿用服务端领域名称。
