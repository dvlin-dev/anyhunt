# Anyhunt Agent、Topic 与 Skills 架构

本文是 Anyhunt 1.0 领域模型、Pi Runtime、Tool/MCP 和 Agent Skills 的稳定技术事实源。产品目的
与范围以[产品目的](product-purpose.md)为准，阶段性重建和删除路径写在 `docs/plans/*`。

## 架构原则

1. Topic 是持续产生 Digest 的研究主体，Subscription 只是用户关注关系。
2. 一个 Topic 只运行一次，订阅者共享成功 Run；个性化需求通过创建或 Fork Topic 表达。
3. 底层只有一个通用 Pi Agent，不为搜索、RSS、SQL 或平台建立专用 Agent 类型。
4. 外部能力统一注册为本地 Tool 或 MCP Tool；工具描述能力，不承载业务 Workflow。
5. 可复用经验统一使用 [Agent Skills 开放规范](https://agentskills.io/specification)，不发明私有 DSL。
6. Topic 可组合多个 Skill，但只有一个 Managed Skill 可以由 Anyhunt 自动更新。
7. Agent 决定如何研究；Host 决定权限、预算、停止、持久化、证据和投递。
8. Skill 是可编辑的方法说明，不是执行轨迹、数据库 State 或模型隐藏记忆。

## 领域模型

### 关系总览

```text
User ──creates──> Topic ──produces──> Run ──contains──> RunItem
                    │                   │
                    │                   └──delivers──> Delivery
                    │
                    ├──managed──> Skill ──contains──> SkillVersion
                    ├──attaches──> Skill
                    └──followed by──> Subscription <── User

User + canonicalUrlHash ──> UserItemState
User ──reports──> TopicReport ──targets──> public Topic
```

### 8 个闭环模型与 1 个治理模型

| 模型            | 唯一职责                       | 关键关系                                |
| --------------- | ------------------------------ | --------------------------------------- |
| `Topic`         | 持续研究目标与共享信息流       | 属于创建者；产生 Run；关联 Skill        |
| `Subscription`  | 用户关注 Topic 与投递偏好      | `userId + topicId` 唯一                 |
| `Skill`         | 可导入、导出和复用的标准 Skill | 属于用户；保存当前版本                  |
| `SkillVersion`  | 不可变 Skill 包版本            | 属于 Skill；内容哈希唯一                |
| `Run`           | Topic 的一次 Agent 执行        | 属于 Topic；保存检查点与结果            |
| `RunItem`       | 本期最终内容与证据快照         | 属于 Run；按 URL Hash 幂等              |
| `UserItemState` | 用户对某个 URL 的阅读反馈      | `userId + canonicalUrlHash` 唯一        |
| `Delivery`      | Email/Webhook 的持久化投递状态 | `runId + subscriptionId + channel` 唯一 |

公开 Topic 还需要一个辅助模型 `TopicReport`，用于举报、下架和审核。它不是研究闭环的一部分，
但公开 UGC 上线不可缺少。因此保留公开 Topic 时，Anyhunt 共有 9 个产品数据模型。

认证 Session、LLM Provider 配置、AdminAuditLog、RequestLog 和 IdempotencyRecord 属于支撑系统，
不计入产品领域模型。

### 不建立的模型

- `Edition`：成功 Run 本身就是一期内容；
- `Inbox`：由 Subscription、RunItem 和 UserItemState 查询得到；
- `ContentItem` / `Enrichment`：RunItem 保存所需快照，采集缓存留在基础设施；
- `Source` / `SubscriptionSource`：来源与查询方法写入 Skill，采集能力注册为 Tool；
- `FeedbackPattern`：Save/Not Interested 只影响用户自己的 Inbox 状态，不自动改变共享 Topic；
- `Schedule`：调度字段保存在 Topic，执行由 BullMQ 负责；
- `Evidence`：运行中使用 Evidence Ledger，最终证据固化在 RunItem；
- 商业化、余额、会员等级与兑换模型：1.0 不接入；
- `Workflow` / `Connector` / `Strategy` / `Memory` / 通用 `State`：不属于当前产品。

## Topic 与 Subscription

### Topic

Topic 至少保存：

- 创建者、标题、自然语言研究目标和可选描述；
- `PRIVATE | UNLISTED | PUBLIC` 可见性；
- 语言、Cron、时区、启用状态、`nextRunAt` 和 `lastRunAt`；
- 可空 `managedSkillId`；
- 多个 Attached Skill 的普通多对多关系。

创建 Topic 时，在同一事务内为创建者建立 Subscription 并排队首次 Run。创建者控制研究目标、
调度、可见性、Managed Skill 和 Attached Skill。订阅者不能修改 Topic 或触发手动 Run；需要不同
研究方法时执行 Fork，生成新的私有 Topic 和 Subscription。Fork 只复制公开的 Topic 目标与基础
设置，不复制原创建者的 Managed Skill、私有 Attached Skill 或历史 Run。

同一用户可以创建语义相似的 Topic，1.0 不做语义合并或全局 Topic 去重。

### Subscription

Subscription 只保存：

- `userId`、`topicId`、启用状态和订阅时间；
- Inbox、Email、Webhook 投递开关及其必要配置；
- 取消订阅时间，用于保留历史 Inbox 而不再接收新 Run。

研究目标、频率、语言、工具、Skill 和模型配置都不进入 Subscription。`userId + topicId` 唯一，
重复关注必须幂等。

取消订阅时设置 `enabled = false` 和 `canceledAt`。取消状态下，Inbox 只查询 `subscribedAt` 到
`canceledAt` 之间的成功 Run；恢复时复用原记录并清空 `canceledAt`。这样不引入订阅周期模型，
停订期间的内容会重新出现在 Inbox，但不会补发 Email/Webhook。

### Run、Inbox 与公开页面

- Scheduler 和手动触发都创建 Topic Run；同一 Topic 的同一计划时间只能有一个 Run。
- 成功 Run 的 RunItem 直接构成公开 Topic 的一期内容，不再复制到 Edition 表。
- Inbox 按 Subscription 的有效时间查询成功 RunItem，并左连接 UserItemState；不写入 Inbox 表。
- 取消订阅只停止未来内容，历史阅读状态继续保留。
- RunItem 保存 `title`、`url`、`canonicalUrlHash`、`summary`、`selectionReason`、`rank` 和必要来源快照。
- 不保存 numeric score；排序是本次 Run 的结果，不成为长期领域事实。

### Delivery

Inbox 是即时查询，不创建 Delivery。只有 Email/Webhook 创建 Delivery：

- 唯一键为 `runId + subscriptionId + channel`；
- 保存 `PENDING | DELIVERED | FAILED`、尝试次数、最后错误和时间戳；
- BullMQ 负责重试，Delivery 是幂等和运营诊断的权威事实；
- Webhook Secret 和 Email 地址属于 Subscription，不复制到 Run 或日志。

## Topic 与多个 Skill

### 两种使用方式，一个 Skill 格式

```text
Topic
├── managedSkillId：0 或 1 个
└── attachedSkills：0 到多个
```

两者都使用相同的 `Skill` / `SkillVersion` 模型和标准 Agent Skill 文件格式，不建立 ManagedSkill、
AttachedSkill、Role、Priority 或 Workflow 模型。

### Managed Skill

- Topic 首次成功 Run 后自动创建；
- 由 Topic 创建者拥有，并自动完整加载到后续 Run；
- 只有它能被 `save_skill` 自动新增版本；
- 记录该 Topic 已验证的来源、查询方式、验证规则、失败方式和回退策略；
- 用户可以查看、导出、回退或重新生成，但不能把 Imported Skill 静默转换为可自动修改对象。

### Attached Skill

- 用户可以把自己导入或拥有的多个 Skill 关联到 Topic；
- 会话开始只提供 `name` 与 `description`，Pi 通过 `activate_skill` 按需加载正文和资源；
- Anyhunt 永远不自动修改 Attached Skill；
- 从 Attached Skill 得到的 Topic 专属新经验写入 Managed Skill；
- 取消关联不删除 Skill，也不影响其他 Topic；同一 Skill 不能重复关联同一 Topic。

1.0 为单个 Topic 设置 20 个 Attached Skill 的安全上限。这是上下文和滥用保护，不是领域结构
限制；以后可按运行数据调整，不需要迁移模型。

### 冲突处理

不建立 Skill 冲突引擎。运行时采用固定优先级：

```text
Host 安全与权限规则
  > Topic 研究目标
  > Topic Managed Skill
  > 按需激活的 Attached Skill
```

Attached Skill 只在不违背更高层约束时生效。互相矛盾时由 Pi 根据 Topic 目标选择，Host 始终控制
工具权限、预算和副作用。

## Agent Skills 包

Anyhunt 采用官方目录格式：

```text
skill-name/
├── SKILL.md
├── references/   # 可选，按需读取
└── assets/       # 1.0 仅允许 UTF-8 文本资产
```

`SKILL.md` 必须包含标准 YAML Frontmatter。校验遵循官方名称与描述约束，正文保持在 500 行和
5,000 tokens 以内；扩展内容放入引用文件，并在正文中说明何时读取。

1.0 支持规范的安全子集：

- 接受 `SKILL.md`、`references/` 和 UTF-8 文本 `assets/`；
- 拒绝路径穿越、符号链接、二进制文件、超限包和 `scripts/`；
- 不执行导入内容中的任何代码；
- 导入时记录来源 URL、内容哈希和版本，默认停用；
- 远程内容不自动更新，更新必须形成新版本并可回退；
- 导出仍是标准 Agent Skill 目录包。

参考：

- [Agent Skills 规范](https://agentskills.io/specification)
- [客户端接入指南](https://agentskills.io/client-implementation/adding-skills-support)
- [Skill 创建建议](https://agentskills.io/skill-creation/best-practices)
- [Skill 评估指南](https://agentskills.io/skill-creation/evaluating-skills)

## Pi Agent Host

```text
Topic Scheduler / Owner Manual Run
          ↓
Anyhunt Agent Host
  ├── 加载 Topic、Managed Skill 与 Attached Skill Catalog
  ├── 创建唯一 Pi Agent
  ├── 注册本地 Tool 与允许的 MCP Tool
  ├── 执行预算、超时、取消和检查点
  ├── 维护本轮 Evidence Ledger
  └── 校验 submit_digest 与可选 save_skill
          ↓
Run / RunItem → Subscription → Inbox 查询与 Delivery
```

Pi 是唯一 Agent Loop。Anyhunt 只实现 Provider 解析、事件适配、工具注册和生命周期管理，不复制
Pi 内部循环，也不建立第二套 Agent 抽象。

Host 负责：

- 创建、恢复、取消和终止 Run；
- 设置最大运行时长、模型轮次、工具调用数、Token 和内部成本观测上限；
- 在模型响应和工具调用边界保存最小检查点；
- 规范化证据 URL，维护本轮真实工具结果的 Evidence Ledger；
- 只接受引用 Ledger 中证据的 RunItem；
- 幂等写入 Run、RunItem、UserItemState 查询基础和 Delivery；
- 将内部错误映射为安全、可操作的产品错误。

检查点是 Run 的恢复数据，不演化为通用 State，也不保存隐藏思维过程。Token、工具调用和估算成本
只用于运行保护与运营观察，不形成余额、账单或用户权益。

## Tool 与 MCP

本地 Tool 与 MCP Tool 进入同一个启动后冻结的注册表。每个工具声明名称、描述、Zod 输入、权限
类别、超时、结果上限和执行函数。1.0 内置：

- `web_search`
- `web_fetch`
- `read_rss`
- `crawl_site`
- `submit_digest`
- `save_skill`
- 内部 `activate_skill`

SQL、第三方 API 和新平台以后作为新 Tool 或 MCP Server 接入，不改变 Topic、Subscription、Run
或 Skill 模型。

安全合同：

- Tool 授权只来自 Host 冻结后的注册表，Prompt 或 Skill 中的工具名称不产生权限；
- Skill、网页正文、模型输出和 MCP 返回内容都视为不可信输入；
- 所有 URL 工具在初始请求和每次重定向时复用共享 SSRF Guard；
- 工具结果有字符数、条目数和媒体类型上限；
- 具有副作用的工具必须单独授权并具备幂等键；
- 1.0 不向 Agent 暴露任意 Shell、文件系统或 SQL 写入；
- MCP Server 仅由服务端运营配置，连接参数保存在部署密钥中。

Webhook 默认只允许 HTTPS，并在初始请求和重定向上执行 SSRF Guard。本地 Compose 验收可以显式配置
一个完全相等的内部 HTTP Sink URL；该例外不接受前缀、同主机其他路径或重定向，未配置时不生效。

## Digest 提交与可靠性

Agent 必须通过 `submit_digest` 提交结构化结果。Host 验证每个 URL 存在于本轮 Evidence Ledger，
规范化并去重后，在一个事务内写入 RunItem 和 Run 结果。空结果可以成功，但必须包含经过真实工具
调用支持的原因。

- Topic Scheduler Job、Run Job、`submit_digest` 和 Delivery Job 都必须幂等；
- 取消请求设置持久化标记并触发 AbortSignal；
- Owner 可从活动 Topic 或私有 Run 页面停止当前 Run；公开 Run 页面不暴露控制操作；
- 进程中断后从最近完整模型/工具边界恢复，不重放已完成副作用；
- 已提交 Run 只恢复 Delivery，不再次运行 Agent；
- Managed Skill 更新失败不回滚有效 Digest，并保留上一版本；
- 日志只包含 ID、模型、工具名、计数、耗时和脱敏错误；
- 指标覆盖成功率、取消率、恢复率、工具错误、证据拒绝、Token、估算成本和投递延迟。

## 当前模块边界

```text
apps/server/src/
├── agent/          # Runtime-neutral 合同、Pi Adapter、Runner、Tool/MCP、Skills
├── topic/          # Topic、共享 Run、调度和 Owner 命令
├── subscription/   # 关注关系与投递偏好
├── inbox/          # 无表查询与 UserItemState
├── delivery/       # Email/Webhook 幂等投递
├── auth user admin llm
└── search map scraper browser  # Agent 内部采集能力
```

- `agent` 不拥有 Topic、Subscription 或 Delivery；
- `topic` 不实现 Provider、采集或投递；
- `subscription` 不保存研究目标、Tool、Skill、模型或调度；
- `inbox` 不建立领域表；
- `delivery` 不生成研究内容；
- 采集模块不依赖产品领域；
- Web/Admin 只通过函数式 API Client 访问 Server。

安装、验证与部署入口见根 `README.md`；阶段性计划不得成为稳定架构的重复事实源。
