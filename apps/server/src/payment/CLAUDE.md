# 旧 Payment 模块

本目录是待删除的旧商业化实现。Anyhunt 1.0 不接入 Payment、付费订阅或 Credits，禁止继续扩展
Checkout、订单、Product 映射或 Webhook 产品面。删除路径以
`docs/plans/2026-08-02-anyhunt-1.0.md` 为准。

## 删除前必须保持的合同

- 读取事件数据前必须验证 Webhook 签名。
- 每个 Provider Event ID 只持久化一次，保证重试幂等。
- 非零支付记录必须先生成最小化加密运营归档并验证数据库备份，才能删除表和代码。
- 删除过程中不得把 Provider 凭据、完整 Webhook Payload 或用户数据写入日志和 fixture。
