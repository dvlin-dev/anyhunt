# LLM

Dynamic provider and model configuration for Digest generation.

## Responsibilities

- Admin CRUD for providers, models and the default Digest model.
- Encrypt provider credentials at rest with AES-256-GCM.
- Resolve an enabled provider/model and construct an AI SDK language model.

## Boundaries

- The only runtime purpose is `digest`.
- Provider credentials are never returned in API responses.
- `ANYHUNT_LLM_SECRET_KEY` is a base64-encoded 32-byte key.
- Supported providers are OpenAI, OpenAI-compatible, OpenRouter, Anthropic and Google.
- No generic Agent SDK adapter, extraction model or per-user model policy.
