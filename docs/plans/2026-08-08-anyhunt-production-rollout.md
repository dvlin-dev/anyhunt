# Anyhunt 生产部署实施计划

> 本计划用于把 Anyhunt 1.0 部署到独立 Dokploy 项目。稳定部署事实以
> `docs/deployment.md` 为准；本文持续记录本次切换状态和脱敏验证证据。

## 目标与原则

- 将当前 `main` 的完整 1.0 实现部署到新的 Anyhunt production 环境；
- 保留既有 `anyhunt.app`、`server.anyhunt.app`、`admin.anyhunt.app` 域名与 HOST 端口合同；
- Anyhunt 独立拥有 PostgreSQL、Redis、SearXNG、密钥和持久化卷，不继续依赖 Moryflow；
- 真实 Provider 配置来自本地未跟踪 `.env`，只通过部署密钥注入；
- 新环境验证通过前只停止旧服务，不删除；验证通过后仅删除旧 Anyhunt 服务；
- 坚持 YAGNI：一个 Compose 栈、一个迁移任务、一个 Provider Seed，不建立额外部署平台或兼容层。

## 实施阶段

| 阶段 | 工作                                  | 状态 | 验证证据                                                             |
| ---- | ------------------------------------- | ---- | -------------------------------------------------------------------- |
| 1    | 审计旧环境的服务、端口、域名与变量键  | 完成 | 已确认 3200/3202/3203；旧 Console 3201、Docs 3204 不迁移；密钥未输出 |
| 2    | 建立生产 Compose 与运维事实源         | 完成 | 配置解析、镜像构建、空卷迁移、Provider Seed 与健康检查通过           |
| 3    | 提交并推送 `main`                     | 完成 | `694f193`、`fe32e80` 已推送，GitHub CI 均通过                        |
| 4    | 在新 Dokploy 环境创建并配置 Compose   | 完成 | `main`、生产 Compose、受保护环境变量和 On Push 自动部署已生效        |
| 5    | 停止旧 Anyhunt 服务并切换正式端口     | 完成 | 临时 330x 预演后切换到 3200/3202/3203，三个公网入口正常              |
| 6    | 生产真实页面、Provider 与核心流程验收 | 完成 | 真实研究、Tool、Evidence、Inbox、Skill、取消与 Admin 诊断通过        |
| 7    | 删除旧 Anyhunt 服务并完成最终复核     | 完成 | 旧五个 Anyhunt 服务已删除；Moryflow 3100–3103 保持不变               |

## 旧部署审计基线

旧环境的 Anyhunt 服务为：

- `anyhunt-www-3200`：HOST 3200 → 容器 3000；
- `anyhunt-console-3201`：旧产品面，1.0 删除；
- `anyhunt-server-3202`：HOST 3202 → 容器 3000；
- `anyhunt-admin-3203`：旧 HOST 3203 → 容器 80，新镜像改为容器 8080；
- `anyhunt-docs-3204`：旧产品面，1.0 删除。

旧环境未在 Dokploy 创建 Domain/Traefik 规则，公网域名由 HOST 端口转发提供。旧数据库和 Redis 是
外部服务，且环境中包含已删除产品的向量、Embedding、Memox、计费和内部 Token 配置；新部署不复用
这些依赖或变量。Moryflow 的 3100–3103 服务不在本次操作范围。

## 上线门禁

- [x] `compose.production.yml` 可在空环境完成配置解析；
- [x] PostgreSQL/Redis 使用命名卷，数据库和内部采集服务无公网端口；
- [x] Server/Web/Admin 镜像构建通过且以非 root 运行；
- [x] migration 与 Provider Seed 从空库成功执行；
- [x] 三个公网域名返回预期页面/健康状态；
- [x] 真实账号完成注册、验证与登录验收；
- [x] 真实 Provider 完成 Topic → Tool → Evidence → RunItem → Skill；
- [x] 生产 Stop 与 Inbox 投递通过；检查点恢复已由生产镜像 E2E 覆盖；
- [x] 页面、Console、请求日志和服务日志无未解决阻断错误；
- [ ] 邮件传输已配置，注册 OTP、密码重置与 Email Delivery 可用；
- [x] 旧 Anyhunt 五个服务删除，Moryflow 服务未变更；
- [x] 回滚步骤和未完成风险已记录；
- [ ] Dokploy 已配置远程 S3 Destination，并为生产卷建立定时备份。

## 验证记录

上线前已按 `compose.production.yml` 从空命名卷启动本地生产拓扑：

- PostgreSQL、Redis、SearXNG、Server、Web、Admin 全部健康；
- Migrate 与 Provider Seed 退出码为 0，数据库存在一个加密 Provider 和一个默认 Model；
- Web 3200、Server 3202 `/health/ready`、Admin 3203 `/health` 均返回 200；
- SearXNG JSON 搜索返回 200；Server/Web/Admin 运行用户分别为 `anyhunt`、`node`、`101`；
- 发现部署平台会把未配置的 `SMTP_URL` 注入为空字符串，已在配置边界统一归一为空值并增加回归测试。
- 新 Dokploy Compose 已绑定 `dvlin-dev/anyhunt` 的 `main` 与 `compose.production.yml`，On Push 已启用；
  密钥环境已通过受保护编辑器写入，未进入 Git、文档或截图。

生产切换与真实页面验收结果：

- `anyhunt.app`、`server.anyhunt.app`、`admin.anyhunt.app` 已分别落到 3200、3202、3203；
  Server readiness 确认 PostgreSQL、Redis、Queue 均可用；
- 真实账号在公开 Web 完成注册、运营验证与登录，创建 Topic 并发起两次手动 Run；验收结束后账号及其
  Topic、Run、Skill、Subscription 已清除，生产库对应记录回到 0；
- 真实 Provider 使用模型 `gpt-5.6-terra`，端点类型为 OpenAI-compatible proxy；成功 Run 耗时
  27.7 秒，完成 5 个 Turn 和 4 次 Tool Call（Search、Fetch、提交结果、保存 Skill），生成 1 条
  有官方证据的 Inbox 结果和 1 个健康 Managed Skill；
- 第二次 Run 在页面停止后持久化为 `CANCELED`；服务日志中的执行耗时为 9.6 秒，取消中的 Fetch
  以 `ABORTED` 正常结束；
- Admin 能核对相同的 Run、模型、Tool、Token、Skill 与队列状态；四类队列等待、活动和失败数均为
  0，管理端 500 请求筛选无记录；Web/Admin 浏览器 Console 与页面错误均为空；
- 全部六个常驻容器健康，Migrate 和 Provider Seed 退出码为 0；日志没有崩溃、异常重启或未解决错误；
- 旧环境的 `anyhunt-www-3200`、`anyhunt-console-3201`、`anyhunt-server-3202`、
  `anyhunt-admin-3203`、`anyhunt-docs-3204` 已删除；Moryflow 的四个 310x 服务未改动。

## 当前公开上线门禁

核心研究闭环和独立生产栈已经可用，但尚不应开放公共注册：

1. Dokploy 尚未配置 `RESEND_API_KEY` 或 `SMTP_URL`，因此注册 OTP、密码重置和 Email Delivery
   不能作为生产能力承诺；本次账号验证仅用于受控部署验收，没有在代码中加入绕过逻辑。
2. Dokploy 当前没有可用的 S3 Destination，`postgres-data` 与 `redis-data` 尚未建立远程定时备份。

任何密钥、Authorization Header、完整 Prompt、Skill 正文和采集正文都不得写入本计划。
