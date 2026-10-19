import { releaseRunLock } from './support/run-lock';
import { backend, frontend } from './support/servers';

/** Stops both servers the setup started and lets the next E2E run go. The E2E database stays for inspection until the next run drops it. */
export default async function globalTeardown(): Promise<void> {
  try {
    await Promise.all([backend.stop(), frontend.stop()]);
  } finally {
    releaseRunLock();
  }
}
