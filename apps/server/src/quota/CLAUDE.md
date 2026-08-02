# Quota

Usage accounting for daily free credits, subscription allowance, and purchased credits.

## Responsibilities

- Report available allowance and transaction history.
- Deduct allowance before metered work and refund failed work.
- Reset daily and monthly buckets on their defined UTC boundaries.
- Add purchased credits only from a validated order.

## Constraints

- Deduction order is daily, then monthly, then purchased credits.
- Metered operations pre-deduct and refund on failure; cache hits do not consume quota.
- Redis and Lua protect concurrent daily-credit updates; PostgreSQL is authoritative for
  persisted quota transactions.
- Every refund has a unique reference ID and is safe to retry.
- Repository deduction can report no available transaction; callers must handle that
  result without dereferencing it.
- Tier amounts and reset rules live in `quota.constants.ts`, not in documentation.
- Integration tests that touch daily credits must remove their Redis keys to avoid
  cross-test state.
