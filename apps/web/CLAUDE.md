# Anyhunt Web

面向终端用户的 TanStack Start 应用，用于发现主题、管理订阅和阅读个人 Digest 收件箱。

## 边界

- 产品导航包括 Explore、Topics，以及登录后的收件箱与账号界面。
- 服务端状态使用 TanStack Query，共享客户端状态使用 Zustand。
- 每次 SSR 请求都创建新 Router，并保证 Nitro React 依赖唯一。
- 用户可见文案使用英文，UI 基础组件来自 `@anyhunt/ui`。
