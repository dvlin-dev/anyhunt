# 旧 Quota 模块

本目录是待删除的旧 Credits 与订阅额度实现。Anyhunt 1.0 使用服务级并发、超时、Tool 调用、Token
和内部估算成本上限保护运行，不建立用户 Credits、Tier 或扣费模型。删除路径以
`docs/plans/2026-08-02-anyhunt-1.0.md` 为准。

## 删除前必须保持的合同

- PostgreSQL 配额交易在删除前仍是旧用量事实源，迁移不得猜测或静默丢弃。
- 每笔退款都有唯一 Reference ID，可安全重试。
- Repository 扣减可能返回无可用交易；调用方不得直接解引用该结果。
- 删除 migration 执行前必须核对记录数量并验证可恢复备份。
