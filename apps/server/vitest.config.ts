/**
 * Vitest 配置文件
 * 支持单元测试、集成测试、E2E 测试，排除渲染测试（CI only）
 */
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

const shouldRunIntegrationTests = process.env.RUN_INTEGRATION_TESTS === '1';

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts', 'scripts/**/*.spec.ts'],
    exclude: [
      '**/*.render.spec.ts', // 渲染测试默认排除，仅 CI 运行
      ...(shouldRunIntegrationTests
        ? []
        : ['**/*.integration.spec.ts', '**/*.e2e.spec.ts']),
    ],
    setupFiles: ['./test/setup.ts'],
    globalSetup: shouldRunIntegrationTests
      ? ['./test/integration.global-setup.ts']
      : [],
    testTimeout: shouldRunIntegrationTests ? 120_000 : 30_000,
    hookTimeout: shouldRunIntegrationTests ? 120_000 : 30_000,
    fileParallelism: !shouldRunIntegrationTests,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
        'src/main.ts',
        'src/**/*.module.ts',
        'src/**/*.constants.ts',
        'src/**/*.types.ts',
        'generated/**',
      ],
      thresholds: {
        // 1.0 全局基线；关键安全路径由专门的行为测试固定。
        global: { statements: 60, branches: 60 },
      },
    },
    // 容器由 globalSetup 共享；测试模块本身保持隔离，防止 mock 串扰。
    pool: 'forks',
    isolate: true,
  },
});
