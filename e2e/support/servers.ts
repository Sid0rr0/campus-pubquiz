import { createRequire } from 'node:module';
import path from 'node:path';
import {
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  BACKEND_PORT,
  BACKEND_URL,
  DATABASE_URL,
  FRONTEND_PORT,
  FRONTEND_URL,
  NEXT_DIST_DIR,
  PATHS,
} from './env';
import { ManagedServer } from './managed-server';

const SERVER_START_TIMEOUT_MS = 60_000;

/** Node's own entry point for `next`, so no pnpm or shell wrapper sits between us and the server process. */
function resolveNextBin(): string {
  const requireFromFrontend = createRequire(
    path.join(PATHS.frontendDir, 'package.json'),
  );
  return requireFromFrontend.resolve('next/dist/bin/next');
}

/**
 * The E2E backend: `node dist/main` on :3001 against `campus_pubquiz_e2e`.
 * NODE_ENV stays unset on purpose: production would make the session cookie
 * Secure (this stack is plain HTTP) and force SSL on the database connection.
 *
 * Specs that need a backend restart call `backend.stop()` and `backend.start()`; the process is shared by every worker.
 */
export const backend = new ManagedServer({
  name: 'backend',
  port: BACKEND_PORT,
  readyUrl: `${BACKEND_URL}/`,
  command: process.execPath,
  args: ['dist/main'],
  cwd: PATHS.backendDir,
  env: {
    PORT: String(BACKEND_PORT),
    DATABASE_URL,
    FRONTEND_ORIGIN: FRONTEND_URL,
    BOOTSTRAP_ADMIN_USERNAME: ADMIN_USERNAME,
    BOOTSTRAP_ADMIN_PASSWORD: ADMIN_PASSWORD,
    SENTRY_DSN: '',
  },
  processHint: 'dist/main',
  startTimeoutMs: SERVER_START_TIMEOUT_MS,
});

/** The E2E frontend: the production build in `.next-e2e`, served by `next start` on :8889. */
export const frontend = new ManagedServer({
  name: 'frontend',
  port: FRONTEND_PORT,
  readyUrl: `${FRONTEND_URL}/`,
  command: process.execPath,
  args: [resolveNextBin(), 'start', '-p', String(FRONTEND_PORT)],
  cwd: PATHS.frontendDir,
  env: {
    NEXT_DIST_DIR,
    NEXT_PUBLIC_BACKEND_URL: BACKEND_URL,
  },
  processHint: 'next',
  startTimeoutMs: SERVER_START_TIMEOUT_MS,
});
