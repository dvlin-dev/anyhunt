# Auth

Better Auth 负责账号注册与身份验证。Anyhunt Token 服务将成功登录适配为产品 API 使用的
Bearer Token 合同。

## 合同

- Auth 路由位于 `/api/v1/auth/*`。
- 产品 API 接受 `Authorization: Bearer <accessToken>`。
- 邮箱密码或邮箱 OTP 登录成功后返回 Access Token 与 Refresh Token。
- Refresh Token 从请求体读取，每次刷新时轮换，并可由 logout/sign-out 幂等撤销。
- Access Token 只承载身份和授权所需声明，不包含会员、余额或产品配额。
- `RequireAdmin` 检查持久化管理员标记；`ADMIN_EMAILS` 用于初始化该标记。
- 生产配置必须定义规范 Auth URL、可信 Origin、安全 Cookie 行为与强密钥。

`auth.controller.ts` 适配 Better Auth Handler，`auth.tokens.service.ts` 负责 Token 生命周期，
Guard 将已验证身份附加到请求。JWKS 集成测试保证签发的 Access Token 可被外部验证。
