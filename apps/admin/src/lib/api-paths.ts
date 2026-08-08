/**
 * [DEFINES]: ADMIN_API, USER_API
 * [USED_BY]: features/*, lib/api-client
 * [POS]: Admin API 路径常量定义
 *
 * [PROTOCOL]: 仅在本文件 Header 事实或所属目录职责、结构、关键契约变化时，才更新 Header 或目录 CLAUDE.md。
 */

export const ADMIN_API = {
  USERS: '/api/v1/admin/users',
  DASHBOARD: '/api/v1/admin/dashboard',
  QUEUES: '/api/v1/admin/queues',
  TOPICS: '/api/v1/admin/topics',
  TOPIC_REPORTS: '/api/v1/admin/topic-reports',
  SUBSCRIPTIONS: '/api/v1/admin/subscriptions',
  RUNS: '/api/v1/admin/runs',
  DELIVERIES: '/api/v1/admin/deliveries',
  SKILLS: '/api/v1/admin/skills',
  MCP: '/api/v1/admin/mcp',
  LOGS_REQUESTS: '/api/v1/admin/logs/requests',
  LOGS_OVERVIEW: '/api/v1/admin/logs/overview',
  LOGS_USERS: '/api/v1/admin/logs/users',
  LOGS_IP: '/api/v1/admin/logs/ip',
  // LLM
  LLM_SETTINGS: '/api/v1/admin/llm/settings',
  LLM_PROVIDERS: '/api/v1/admin/llm/providers',
  LLM_PROVIDER_PRESETS: '/api/v1/admin/llm/providers/presets',
  LLM_MODELS: '/api/v1/admin/llm/models',
} as const;

export const USER_API = {
  ME: '/api/v1/app/user/me',
} as const;
