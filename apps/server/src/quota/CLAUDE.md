# Quota

每日免费 Credits、订阅额度与已购 Credits 的用量核算。

## 职责

- 返回可用额度与交易历史。
- 计费工作执行前扣减额度，工作失败时退款。
- 在规定的 UTC 边界重置每日和每月额度。
- 只允许根据已验证订单增加已购 Credits。

## 约束

- 扣减顺序为每日额度、每月额度、已购 Credits。
- 计费操作预扣，失败时退款；缓存命中不消耗配额。
- Redis 与 Lua 保护每日 Credits 并发更新；PostgreSQL 是持久化配额交易的权威事实源。
- 每笔退款都有唯一 Reference ID，可安全重试。
- Repository 扣减可能返回无可用交易；调用方不得直接解引用该结果。
- Tier 数额与重置规则只记录在 `quota.constants.ts`，不写入文档。
- 涉及每日 Credits 的集成测试必须清理 Redis Key，避免测试间状态污染。
