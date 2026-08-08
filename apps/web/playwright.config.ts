import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  outputDir: '../../.artifacts/acceptance/playwright-web',
  use: {
    baseURL: process.env.WEB_E2E_BASE_URL ?? 'http://localhost:3001',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
