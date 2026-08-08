# Admin 服务端模块

为仪表盘、用户、Topic、Subscription、Run、Delivery、Skill、任务、队列和模型提供会话认证的
运营 API。

- 每个 Controller 都使用 API 版本 `1` 并要求 `RequireAdmin`。
- 不提供公开端点或独立管理员凭据。
- 队列监控覆盖内部采集、Topic 调度、Agent Run 与 Delivery 队列。
- Run 诊断只返回模型、Tool、Token、耗时、恢复次数和脱敏错误，不返回 Prompt、Skill 正文或凭据。
- MCP 状态只暴露运行时连接健康和允许的 Tool，不返回 URL、Header 或连接参数。
- 不提供商业化、会员等级、余额或兑换 API。
- 运营时间分桶统一使用 UTC。
