import path from 'node:path';

/**
 * Everything that makes the E2E stack its own: ports, database and build
 * folder differ from the dev stack (:8888/:3000, `campus_pubquiz`, `.next`),
 * so the two can run side by side and E2E never touches the dev servers.
 */

const E2E_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(E2E_ROOT, '..');

export const PATHS = {
  e2eRoot: E2E_ROOT,
  repoRoot: REPO_ROOT,
  backendDir: path.join(REPO_ROOT, 'apps', 'backend'),
  frontendDir: path.join(REPO_ROOT, 'apps', 'frontend'),
  sharedTypesDir: path.join(REPO_ROOT, 'shared', 'types'),
  /** Admin login, process ids and the login pacing record live here; gitignored. */
  stateDir: path.join(E2E_ROOT, '.auth'),
  /** Server output of the E2E stack; gitignored. */
  logDir: path.join(E2E_ROOT, '.logs'),
  csvFixture: path.join(E2E_ROOT, 'fixtures', 'quiz-night.csv'),
} as const;

export const FRONTEND_PORT = 8889;
export const BACKEND_PORT = 3001;
export const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
export const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

/** The frontend's production build folder for E2E (read by next.config.ts). */
export const NEXT_DIST_DIR = '.next-e2e';

export const DATABASE_NAME = 'campus_pubquiz_e2e';
/** The docker-compose Postgres. Override with E2E_POSTGRES_URL (a URL to the server's maintenance database). */
export const POSTGRES_ADMIN_URL =
  process.env.E2E_POSTGRES_URL ??
  'postgres://postgres:postgres@localhost:5432/postgres';
export const DATABASE_URL = (() => {
  const url = new URL(POSTGRES_ADMIN_URL);
  url.pathname = `/${DATABASE_NAME}`;
  return url.toString();
})();

export const ADMIN_USERNAME = 'e2e-admin';
export const ADMIN_PASSWORD = 'e2e-admin-password';

export const ADMIN_STORAGE_STATE = path.join(PATHS.stateDir, 'admin.json');

/** Skips both builds when set; for iterating on specs against an earlier build. */
export const SHOULD_SKIP_BUILD = process.env.E2E_SKIP_BUILD === '1';

/** A quiz-night session in E2E locks its block 2 s after the last question, not 60 s. */
export const E2E_LOCK_GRACE_SECONDS = 2;
