// Creates (or resets) a throwaway admin in the LOCAL dev database, so a browser check can sign in
// on :8888 without the real admin password. Refuses any database that is not on this machine.
import { createRequire } from 'node:module';

const USERNAME = 'claude-dev';
const PASSWORD = 'claude-dev-password';

const url =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/campus_pubquiz';
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url)) {
  throw new Error(`Refusing to touch a non-local database: ${url}`);
}

const { Client } = createRequire(import.meta.url)('../e2e/node_modules/pg');
const bcrypt = createRequire(import.meta.url)(
  '../apps/backend/node_modules/bcryptjs',
);

const client = new Client({ connectionString: url });
await client.connect();
await client.query(
  `INSERT INTO users (username, password_hash, role, status, created_at, updated_at)
   VALUES ($1, $2, 'admin', 'active', now(), now())
   ON CONFLICT (username) DO UPDATE
   SET password_hash = $2, role = 'admin', status = 'active', updated_at = now()`,
  [USERNAME, await bcrypt.hash(PASSWORD, 10)],
);
await client.end();
console.log(`Dev admin ready: ${USERNAME} / ${PASSWORD}`);
