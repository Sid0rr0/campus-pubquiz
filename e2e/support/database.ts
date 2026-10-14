import { Client } from 'pg';
import { DATABASE_NAME, POSTGRES_ADMIN_URL } from './env';

const CONNECT_TIMEOUT_MS = 5_000;

/** A refused connection arrives as an AggregateError with an empty message; the useful part is in its errors' codes. */
function getErrorMessage(error: unknown): string {
  if (error instanceof AggregateError) {
    return error.errors.map(getErrorMessage).join(', ');
  }
  if (error instanceof Error) {
    return error.message || (error as NodeJS.ErrnoException).code || error.name;
  }
  return String(error);
}

/** Opens a connection to the server's maintenance database, or stops the run with a message that says how to start Postgres. */
async function connectToPostgres(): Promise<Client> {
  const client = new Client({
    connectionString: POSTGRES_ADMIN_URL,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Postgres is not reachable at ${POSTGRES_ADMIN_URL} (${getErrorMessage(error)}).\n` +
        `E2E needs the docker-compose Postgres: run \`docker compose up -d postgres\` and try again.`,
    );
  }
  return client;
}

/** Drops `campus_pubquiz_e2e` (if it exists) and creates it empty. Never touches any other database. */
export async function recreateE2eDatabase(): Promise<void> {
  const client = await connectToPostgres();
  try {
    // WITH (FORCE) disconnects a backend left over from a crashed run.
    await client.query(`DROP DATABASE IF EXISTS ${DATABASE_NAME} WITH (FORCE)`);
    await client.query(`CREATE DATABASE ${DATABASE_NAME}`);
  } finally {
    await client.end();
  }
}
