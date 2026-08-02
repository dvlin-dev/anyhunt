# Common

Shared, business-neutral server infrastructure.

## Responsibilities

- Global Zod request validation and RFC 7807 problem responses.
- User-aware rate limiting backed by Redis.
- SSRF-safe URL validation and redirect-aware fetching.
- Shared pagination, JSON, encryption, origin, HTTP, and subscription-tier utilities.
- Webhook delivery and the terminal not-found controller.

## Boundaries

- Common code is stateless or infrastructure-scoped and must not own product policy.
- It must not depend on a business module.
- Every outbound user-supplied URL must pass DNS-aware validation. Redirects require
  validation at every hop, and private, reserved, credentialed, or non-HTTP URLs fail
  closed.
- Shared error codes and problem details are public API contracts; change them
  intentionally and test their serialization.
