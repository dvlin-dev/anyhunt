export interface McpStatus {
  servers: Array<{
    name: string;
    status: 'connected' | 'disconnected';
    tools: string[];
  }>;
}
