import { test as base } from './index';
import { backend } from '../support/servers';

/** The shared E2E backend, which the restart journey is allowed to stop and start. */
export interface RestartableBackend {
  stop: () => Promise<void>;
  start: () => Promise<void>;
}

interface RestartFixtures {
  restartableBackend: RestartableBackend;
}

/**
 * `test` plus a `restartableBackend` that always leaves the backend running
 * when the test ends, passed or failed: the process is shared with every later
 * spec and global teardown, so a test that dies while it is down must not leave
 * it down (or half started).
 */
export const test = base.extend<RestartFixtures>({
  // Playwright requires the first argument to be a destructuring pattern, even when empty.
  // eslint-disable-next-line no-empty-pattern
  restartableBackend: async ({}, use) => {
    try {
      await use({
        stop: () => backend.stop(),
        start: () => backend.start(),
      });
    } finally {
      if (!backend.isRunning()) await backend.start();
    }
  },
});

export { expect } from './index';
