# LLM

Digest 生成使用的动态 Provider 与模型配置。

## 职责

- 为 Provider、模型与默认 Digest 模型提供 Admin CRUD。
- 使用 AES-256-GCM 加密静态存储的 Provider 凭据。
- 解析已启用的 Provider/模型并构造 AI SDK Language Model。

## 边界

- 唯一运行目的为 `digest`。
- API 响应不得返回 Provider 凭据。
- `ANYHUNT_LLM_SECRET_KEY` 是 Base64 编码的 32 字节密钥。
- 支持 OpenAI、OpenAI-compatible、OpenRouter、Anthropic 与 Google。
- 不提供通用 Agent SDK Adapter、独立抽取模型或用户级模型策略。
