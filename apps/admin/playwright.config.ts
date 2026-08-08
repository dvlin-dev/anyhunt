import { defineConfig } from '@playwright/test';

process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

export default defineConfig({
  testDir: './tests',
  timeout: 15 * 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  outputDir: '../../.artifacts/acceptance/playwright-admin',
  use: {
    baseURL: process.env.ADMIN_E2E_BASE_URL ?? 'http://localhost:3002',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    trace: 'on-first-retry',
  },
});
