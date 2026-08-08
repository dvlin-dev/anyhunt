import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/__tests__/**/*.spec.{ts,tsx}'],
  },
  resolve: {
    alias: [
      {
        find: /^@anyhunt\/ui\/lib$/,
        replacement: path.resolve(__dirname, '../../packages/ui/src/lib/index.ts'),
      },
      {
        find: /^@anyhunt\/ui$/,
        replacement: path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      },
      {
        find: /^@anyhunt\/http$/,
        replacement: path.resolve(__dirname, '../../packages/http/src/index.ts'),
      },
      {
        find: /^@\//,
        replacement: `${path.resolve(__dirname, './src')}/`,
      },
    ],
  },
});
