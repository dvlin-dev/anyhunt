import { apiClient } from '@/lib/api-client';
import { ADMIN_API } from '@/lib/api-paths';
import type { McpStatus } from './types';

export function getMcpStatus(): Promise<McpStatus> {
  return apiClient.get(ADMIN_API.MCP);
}
