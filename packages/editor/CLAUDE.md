# Anyhunt Editor

TipTap components, extensions, hooks, and Markdown conversion used by Admin content
editing.

## Contracts

- Consumers import runtime APIs from `@anyhunt/editor`, never internal source paths.
- Consumers import editor styles from `@anyhunt/editor/styles/notion-editor.scss`.
- Public runtime exports and package export maps change together.
- Keep product policy and server data access outside this package.
