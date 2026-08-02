# Payment

Creem checkout and webhook integration for subscriptions and credit purchases.

## Responsibilities

- Create checkout sessions for subscriptions and credit purchases.
- Track orders and activate paid subscriptions.
- Verify and process Creem webhooks.
- Allocate purchased quota through the quota domain.

## Constraints

- The webhook contract is `/api/v1/webhooks/creem`; application endpoints require
  bearer authentication.
- Verify webhook signatures before reading event data.
- Persist each provider event ID once so retries are idempotent.
- Unknown product IDs fail closed. Credit purchases must match configured amount and
  currency before allocation.
- Subscription activation and quota allocation must be atomic from the product's
  perspective and safe to retry.
- Product mappings and prices live in `payment.constants.ts`; the provider dashboard
  must be updated as the same release operation.
