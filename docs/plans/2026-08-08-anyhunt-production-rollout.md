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

| 阶段 | 工作                                  | 状态   | 验证证据                                                             |
| ---- | ------------------------------------- | ------ | -------------------------------------------------------------------- |
| 1    | 审计旧环境的服务、端口、域名与变量键  | 完成   | 已确认 3200/3202/3203；旧 Console 3201、Docs 3204 不迁移；密钥未输出 |
| 2    | 建立生产 Compose 与运维事实源         | 完成   | 配置解析、镜像构建、空卷迁移、Provider Seed 与健康检查通过           |
| 3    | 提交并推送 `main`                     | 完成   | `694f193` 已推送，待 GitHub CI 完成                                  |
| 4    | 在新 Dokploy 环境创建并配置 Compose   | 进行中 | Source、密钥环境和临时 3300/3302/3303 预演端口已配置                 |
| 5    | 停止旧 Anyhunt 服务并切换正式端口     | 未开始 | 待记录切换与回滚锚点                                                 |
| 6    | 生产真实页面、Provider 与核心流程验收 | 未开始 | 待记录脱敏场景、模型、端点类型和结果                                 |
| 7    | 删除旧 Anyhunt 服务并完成最终复核     | 未开始 | 待确认只删除五个 Anyhunt 服务，Moryflow 310x 保留                    |

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
- [ ] 三个公网域名返回预期页面/健康状态；
- [ ] 真实账号完成登录或注册验证；
- [ ] 真实 Provider 完成 Topic → Tool → Evidence → RunItem → Skill；
- [ ] Stop/恢复和至少一种投递路径通过；
- [ ] 页面、Console、服务日志无未解决阻断错误；
- [ ] 邮件传输已配置，注册 OTP、密码重置与 Email Delivery 可用；
- [ ] 旧 Anyhunt 五个服务删除，Moryflow 服务未变更；
- [ ] 生产备份、回滚步骤和未完成风险已记录。

## 验证记录

上线前已按 `compose.production.yml` 从空命名卷启动本地生产拓扑：

- PostgreSQL、Redis、SearXNG、Server、Web、Admin 全部健康；
- Migrate 与 Provider Seed 退出码为 0，数据库存在一个加密 Provider 和一个默认 Model；
- Web 3200、Server 3202 `/health/ready`、Admin 3203 `/health` 均返回 200；
- SearXNG JSON 搜索返回 200；Server/Web/Admin 运行用户分别为 `anyhunt`、`node`、`101`；
- 发现部署平台会把未配置的 `SMTP_URL` 注入为空字符串，已在配置边界统一归一为空值并增加回归测试。
- 新 Dokploy Compose 已绑定 `dvlin-dev/anyhunt` 的 `main` 与 `compose.production.yml`，On Push 已启用；
  密钥环境已通过受保护编辑器写入，未进入 Git、文档或截图。

生产公网与真实页面验证尚未开始。任何密钥、完整端点、Authorization Header、Prompt、Skill 正文和
采集正文都不得写入本计划。
