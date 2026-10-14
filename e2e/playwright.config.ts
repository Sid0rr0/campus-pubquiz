import { defineConfig } from '@playwright/test';
import { FRONTEND_URL } from './support/env';

const TEST_TIMEOUT_MS = 90_000;
const EXPECT_TIMEOUT_MS = 10_000;

export default defineConfig({
  testDir: './tests',
  // A failed test fails loudly; a flaky one is fixed, not retried.
  retries: 0,
  fullyParallel: true,
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: EXPECT_TIMEOUT_MS },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  outputDir: 'test-results',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'journeys', use: { browserName: 'chromium' } }],
});
