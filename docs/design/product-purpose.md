# Anyhunt 产品目的

## 一句话定义

Anyhunt 是一个由 Topic 驱动的持续信息 Agent：每个 Topic 都是一条会自主研究、定期生成 Digest、
并持续积累 Skill 的 AI 信息流，用户通过 Subscription 关注它。

## 为什么需要 Anyhunt

有价值的信息分散在网页、搜索结果、Feed、数据库和不断出现的新平台中。传统订阅工具要求用户
事先知道该订阅哪些来源；一次性 AI 搜索又无法持续跟进，也不会积累下一次可复用的方法。

Anyhunt 的价值不是抓取更多内容，而是把一个自然语言研究目标转化为持续、可靠、会积累经验的
认知流。

## 产品语义

- **Topic 是信息源。** 它拥有研究目标、运行频率、可见性、语言和研究经验，并持续产生 Run。
- **Subscription 是关注关系。** 它只表达某位用户是否关注 Topic，以及如何接收结果。
- **Run 是一期内容。** Topic 的一次成功 Run 就是一份 Digest，不再建立 Edition。
- **Inbox 是查询视图。** 它由用户订阅的 Topic、RunItem 和 UserItemState 组合得到，不单独存储。
- **Skill 是经验。** Topic 可以组合多个 Skill，但只有一个由 Topic 自动维护的 Skill。

创建 Topic 时，系统自动为创建者建立 Subscription。公开 Topic 可以被其他用户订阅；同一个 Topic
只执行一次，所有订阅者共享结果。需要不同研究目标或个性化方法时，用户创建或 Fork 新 Topic，
不在 Subscription 上堆叠研究配置。

## 核心闭环

```text
首次运行
Topic → Pi 自主研究 → Run / Digest → 生成 Topic Managed Skill

后续运行
Topic + Managed Skill + 关联 Skills
  → Pi 复用经验并适应变化
  → Run / Digest
  └→ 稳定的新经验只更新 Managed Skill

订阅与阅读
Topic → Subscription → Inbox 视图 / Email / Webhook
```

所有顶层能力都必须强化研究、交付或经验复用。无法作为这条闭环一部分解释的能力，不进入
Anyhunt 1.0。

## 产品体验原则

1. **一个 Topic 即可开始。** 用户只描述目标和频率，来源发现、查询拆解和工具选择由 Agent 完成。
2. **一次研究，多人复用。** 公开 Topic 的 Run、RunItem 和 Managed Skill 在订阅者之间共享。
3. **信号优先于数量。** 少而有用的变化胜过全面但嘈杂的信息流。
4. **结论在前，证据随时可查。** 每个重要条目必须来自本轮真实工具结果。
5. **经验开放可移植。** Skill 使用 Agent Skills 开放格式，可查看、导入、导出和分享。
6. **自主但有边界。** Agent 自主选择方法；权限、密钥、预算、超时和投递由 Host 控制。
7. **失败可理解、可恢复。** 运行可以停止和恢复，失败不得产生重复内容或重复投递。
8. **数据最小化。** 不保存隐藏思维过程，只保存交付、审计、恢复和改进所需的信息。

## 产品界面

- **阅读端：** 创建、Fork 和订阅 Topic，阅读 Inbox，管理自己 Topic 的 Skill 与投递偏好。
- **Agent 服务：** 调度 Topic Run，执行 Pi Agent，注册 Tool/MCP，加载 Skill，保存结果和检查点。
- **管理端：** 管理模型、公开 Topic、举报、运行健康、队列和服务端 MCP 运行状态。

Web Search、Fetch、RSS、站点抓取、API、SQL 和 Browser 都是 Agent 可以调用的工具能力，
不是独立产品，也不对应独立领域模型。

## 产品与技术边界

- Anyhunt 不是通用 Agent 开发平台、工作流构建器、Connector SDK、向量知识库或自动进化平台。
- 底层运行时是通用 Pi Agent，但公开产品只服务于 Topic 持续研究与 Digest 闭环。
- 不建立 `ResearchConnector`、Workflow DSL、流程图、通用 `State` 或通用 Memory 模型。
- 不建立 Billing、Quota、Payment、Credits、会员等级或 Redemption；1.0 不向用户计费。
- 调度、持久化、去重、权限、运行预算和投递由确定性的 Host 负责；研究方法由 Agent 与 Skill 表达。
- Anyhunt 独立拥有账号、数据和部署。其他产品只能通过显式 HTTP 合同集成，不得导入 Anyhunt
  workspace 包或共享持久化层。

## 1.0 成功标准

Anyhunt 1.0 必须同时满足以下条件：

1. 用户仅用研究目标和频率即可创建 Topic，并立即启动首次研究；
2. Topic 创建者自动订阅，公开 Topic 可被其他用户订阅且不重复执行 Agent；
3. 首次 Run 通过 Pi 自主调用真实工具交付带证据的 Digest，并生成 Managed Skill；
4. 后续 Run 自动加载 Managed Skill，并可按需激活 Topic 关联的多个 Skill；
5. 用户可以导入多个 Skill、关联到自己的 Topic、查看、停用、回退和导出；
6. Imported/Attached Skill 不会被自动修改，稳定的新经验只写入 Managed Skill；
7. 定时运行、手动运行、停止、失败重试和进程重启恢复均不会重复生成或投递；
8. 每个 RunItem 都来自本轮 Evidence Ledger，链接经过规范化、SSRF 防护和去重；
9. Email/Webhook 投递有持久化幂等状态，Inbox 不维护重复数据；
10. 公开 Topic 具备举报、下架和管理端审核能力；
11. 至少一个真实 Provider 与真实采集链路通过脱敏生产 smoke；
12. 旧固定流水线、Source、Score、Edition、Content、Feedback Pattern 和 Billing 体系全部删除。

## 1.0 之外

- Skill Marketplace、评分和社交分发；
- 用户自定义代码或外部 Skill 脚本执行；
- 用户自行配置任意 MCP Server；
- 为每位订阅者生成不同版本的同一 Topic；
- 复杂 Workflow、多人共同编辑、自动进化和无人监管的自修改系统；
- 向量数据库、通用知识库和 Connector SDK。

这些能力只有在核心 Topic 留存和 Digest 质量证明真实需求后，才单独设计。
