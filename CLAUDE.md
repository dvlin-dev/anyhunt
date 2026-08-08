# Anyhunt

Anyhunt 是独立的持续信息 Agent 产品，目标核心闭环为：
Topic -> Pi 自主研究 -> Run/Digest -> 沉淀并复用标准 Skill -> 用户订阅。

## 边界

- `apps/server` 负责认证、Topic、Subscription、Run、投递、采集与调度；Pi Agent Host、Tool/MCP 和 Skills 也只能在此落地。
- `apps/web` 是面向终端用户的阅读端。
- `apps/admin` 是内部运营端。
- 底层 Agent Runtime 保持通用，但只服务于 Anyhunt 产品闭环，不作为独立开发者平台。
- 搜索、抓取、RSS、API、SQL 与 Browser 统一作为 Tool/MCP 接入，不建立平台专用 Connector 或 Workflow。
- Anyhunt 1.0 不接入商业化、余额、会员等级或兑换领域。
- 产品域只包含 Topic、Subscription、Skill、SkillVersion、Run、RunItem、UserItemState、Delivery 和
  TopicReport；Inbox 是查询视图，不建立表。
- Pi 是唯一 Agent Loop；不得引入第二套 Agent Runtime、AI SDK Loop 或固定研究流水线。
- 账号、Token、数据库与部署全部归 Anyhunt 所有；未来商业化也必须保持产品间隔离。
- 跨产品集成必须通过显式 HTTP 合同；产品仓库之间不得共享源码包或持久化层。
- 密钥只能存在于环境变量中，禁止提交。
- 根 `.env` 只用于本地 Compose Provider Seed/Smoke，必须被 Git 忽略并保持 `0600`；Web/Admin
  不得接收 Provider Key。

## 知识库

- `docs/design/product-purpose.md` 是产品目的事实源。
- `docs/design/agent-and-skills.md` 是 Agent、Tool/MCP 与 Skills 架构事实源。
- `docs/index.md` 只做导航，历史过程依赖 Git。
- `README.md` 负责安装、验证与部署入口。
- 目录级 `CLAUDE.md` 只记录稳定职责、边界、合同与不变量；`AGENTS.md` 是指向它的符号链接。
- 仅当目录作用域内文件数超过 10 个时才创建目录级协作文件。
- 计划文档是临时资产；合并前将稳定事实回写知识库，并删除或冻结为简明验证基线。
- 协作文件与源码 Header 禁止记录日期、PR 状态、迁移历史或进度日志。

## 工程规范

- 优先根因重构，不保留已废弃的兼容层。
- 用户可见文案和 API 错误使用英文；开发者文档与代码注释使用中文。
- 客户端状态与请求统一使用 Zustand Store + Methods + Functional API Client。
- TanStack Start SSR 必须按请求创建 Router，并避免多份 React 实例。
- 生产数据库结构变更使用 Prisma migration；`db push` 仅限开发环境。
- 先执行最小相关验证，合并前再执行根级信心套件。
