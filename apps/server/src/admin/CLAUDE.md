# Admin Server Module

Session-authenticated operations APIs for dashboards, users, subscriptions,
orders, credits, jobs, queues and scheduled tasks.

- Every controller uses API version `1` and requires `RequireAdmin`.
- There are no public endpoints or separate admin credentials.
- Queue monitoring covers the internal scrape queue and Digest scheduling,
  execution, refresh and delivery queues.
- Subscription tier calculations use active subscriptions only.
- Operational time buckets use UTC.
