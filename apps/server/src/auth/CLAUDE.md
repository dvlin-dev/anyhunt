# Auth

Better Auth owns account enrollment and identity verification. Anyhunt token services
adapt successful sign-in into the bearer-token contract used by product APIs.

## Contracts

- Auth routes are under `/api/v1/auth/*`.
- Product APIs accept `Authorization: Bearer <accessToken>`.
- Successful email/password or email-OTP sign-in returns an access and refresh token.
- Refresh tokens come from the request body, rotate on refresh, and can be revoked
  idempotently by logout or sign-out.
- Access tokens derive `subscriptionTier` from active subscriptions only.
- `RequireAdmin` checks the persisted admin flag; `ADMIN_EMAILS` seeds that flag.
- Production config must define the canonical auth URL, trusted origins, secure cookie
  behavior, and strong secrets.

`auth.controller.ts` adapts Better Auth handlers, `auth.tokens.service.ts` owns token
lifecycle, and the guards attach verified identity to requests. JWKS integration tests
prove that issued access tokens are externally verifiable.
