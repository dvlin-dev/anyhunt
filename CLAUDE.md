# Anyhunt

Anyhunt 是独立的 AI 信息订阅产品，核心闭环为：
主题 -> 采集 -> 去重 -> 排序 -> Digest -> 收件箱。

## 边界

- `apps/server` 负责认证、计费、Digest、采集与调度。
- `apps/web` 是面向终端用户的阅读端。
- `apps/admin` 是内部运营端。
- 采集模块是产品内部能力，不是独立产品。
- 账号、Token、数据库与计费全部归 Anyhunt 所有。
- 跨产品集成必须通过显式 HTTP 合同；产品仓库之间不得共享源码包或持久化层。
- 密钥只能存在于环境变量中，禁止提交。

## 知识库

- `docs/design/product-purpose.md` 是唯一的产品目的事实源。
- `docs/index.md` 只做导航，历史过程依赖 Git。
- `README.md` 负责安装、验证与部署入口。
- 目录级 `CLAUDE.md` 只记录稳定职责、边界、合同与不变量；`AGENTS.md` 是指向它的符号链接。
- 仅当目录作用域内文件数超过 10 个时才创建目录级协作文件。
- 计划文档是临时资产；合并前将稳定事实回写知识库并删除计划。
- 协作文件与源码 Header 禁止记录日期、PR 状态、迁移历史或进度日志。

## 工程规范

- 优先根因重构，不保留已废弃的兼容层。
- 用户可见文案和 API 错误使用英文；开发者文档与代码注释使用中文。
- 客户端状态与请求统一使用 Zustand Store + Methods + Functional API Client。
- TanStack Start SSR 必须按请求创建 Router，并避免多份 React 实例。
- 生产数据库结构变更使用 Prisma migration；`db push` 仅限开发环境。
- 先执行最小相关验证，合并前再执行根级信心套件。
