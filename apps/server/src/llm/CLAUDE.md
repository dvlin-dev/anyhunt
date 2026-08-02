# LLM

Pi Agent 使用的动态 Provider 与模型配置。

## 职责

- 为 Provider、模型与默认 Agent 模型提供 Admin CRUD。
- 使用 AES-256-GCM 加密静态存储的 Provider 凭据。
- 将已启用的 Provider/模型解析为 Pi 使用的 Model 与 StreamFn。

## 边界

- 唯一运行目的为 Topic Agent Run。
- API 响应不得返回 Provider 凭据。
- `ANYHUNT_LLM_SECRET_KEY` 是 Base64 编码的 32 字节密钥。
- 支持 OpenAI、OpenAI-compatible、OpenRouter、Anthropic 与 Google。
- 不建立第二套凭据表、Agent 抽象、独立抽取模型或用户级模型策略。
- 旧 AI SDK Adapter 在 Pi 路径验证完成后删除，不保留双运行时。
