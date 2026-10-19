import { defineConfig } from '@playwright/test';
import { FRONTEND_URL } from './support/env';

const TEST_TIMEOUT_MS = 90_000;
const EXPECT_TIMEOUT_MS = 10_000;
// After a restart the clients retry with a growing delay (up to 5 s), so they take longer to resync.
const RESTART_TEST_TIMEOUT_MS = 150_000;
const RESTART_EXPECT_TIMEOUT_MS = 30_000;
const RESTART_SPEC = '**/backend-restart.spec.ts';

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
    // Fails a full run that left a status x screen cell or a move unvisited.
    ['./support/coverage-reporter.ts'],
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
  projects: [
    {
      name: 'journeys',
      testIgnore: RESTART_SPEC,
      use: { browserName: 'chromium' },
    },
    {
      // Kills the backend every other journey shares, so it runs alone and last.
      // One spec file with fullyParallel off keeps it on a single worker.
      name: 'backend-restart',
      testMatch: RESTART_SPEC,
      dependencies: ['journeys'],
      fullyParallel: false,
      timeout: RESTART_TEST_TIMEOUT_MS,
      expect: { timeout: RESTART_EXPECT_TIMEOUT_MS },
      use: { browserName: 'chromium' },
    },
  ],
});
