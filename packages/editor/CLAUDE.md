# Anyhunt Editor

供 Admin 内容编辑使用的 TipTap 组件、扩展、Hook 与 Markdown 转换。

## 合同

- 消费方统一从 `@anyhunt/editor` 导入运行时 API，禁止导入内部源码路径。
- 编辑器样式统一从 `@anyhunt/editor/styles/notion-editor.scss` 导入。
- 公开运行时导出与 Package Export Map 必须同步变更。
- 产品策略与服务端数据访问不得进入本包。
