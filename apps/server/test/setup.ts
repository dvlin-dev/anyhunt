/**
 * Vitest 全局 setup
 * 环境变量配置、超时设置
 */
import { vi, afterEach, inject } from 'vitest';

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // 减少测试输出噪音
process.env.EMBEDDING_OPENAI_API_KEY =
  process.env.EMBEDDING_OPENAI_API_KEY ?? 'test-embedding-key';
const isIntegration = process.env.RUN_INTEGRATION_TESTS === '1';
if (isIntegration) {
  process.env.DATABASE_URL = inject('integrationDatabaseUrl');
  process.env.REDIS_URL = inject('integrationRedisUrl');
  process.env.ANYHUNT_DATA_SECRET_KEY = inject('integrationDataSecretKey');
}

// 超时配置
vi.setConfig({
  testTimeout: isIntegration ? 120_000 : 30_000,
  hookTimeout: isIntegration ? 120_000 : 30_000,
});

afterEach(() => {
  vi.clearAllMocks();
});
