import { backend, frontend } from './support/servers';

/** Stops both servers the setup started. The E2E database stays for inspection until the next run drops it. */
export default async function globalTeardown(): Promise<void> {
  await Promise.all([backend.stop(), frontend.stop()]);
}
