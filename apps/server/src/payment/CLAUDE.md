# Payment

用于订阅与 Credits 购买的 Creem Checkout 和 Webhook 集成。

## 职责

- 为订阅和 Credits 购买创建 Checkout Session。
- 跟踪订单并激活付费订阅。
- 验证并处理 Creem Webhook。
- 通过 Quota 领域分配已购买配额。

## 约束

- Webhook 合同为 `/api/v1/webhooks/creem`；应用端点要求 Bearer 认证。
- 读取事件数据前必须验证 Webhook 签名。
- 每个 Provider Event ID 只持久化一次，保证重试幂等。
- 未知 Product ID 必须失败关闭；Credits 购买只有金额与币种匹配配置后才能分配。
- 从产品视角看，订阅激活与配额分配必须原子且可安全重试。
- 产品映射与价格位于 `payment.constants.ts`；Provider 控制台必须在同一次发布操作中更新。
