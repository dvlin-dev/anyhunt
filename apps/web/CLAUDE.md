# Anyhunt Web

面向终端用户的 TanStack Start 应用，用于创建、Fork 和订阅 Topic，阅读 Inbox，并管理自己的
Skill 与投递偏好。

## 边界

- 产品导航包括 Explore、Topics，以及登录后的 Inbox、Skills 与账号界面。
- Topic 是研究配置入口；Subscription 设置只包含关注状态与 Inbox/Email/Webhook 偏好。
- 成功 Run 直接作为一期 Digest 展示；Web 不建立 Edition、Source、Score 或固定 AI Pipeline 配置。
- 服务端状态使用 TanStack Query，共享客户端状态使用 Zustand。
- 每次 SSR 请求都创建新 Router，并保证 Nitro React 依赖唯一。
- 用户可见文案使用英文，UI 基础组件来自 `@anyhunt/ui`。
