import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { MikroORM } from '@mikro-orm/postgresql';
import {
  TEMPLATE_DATABASE,
  TEST_POSTGRES_URI_ENV,
  uriForDatabase,
} from './test-db-env'; // relative: global set-up runs outside Jest's `@/` mapping

const execFileAsync = promisify(execFile);
const BACKEND_DIR = `${__dirname}/../..`;
const CONTAINER_START_TIMEOUT_MS = 120_000;

/** Thrown by testcontainers when no Docker socket answers. */
const NO_RUNTIME_ERROR = 'Could not find a working container runtime strategy';

const DOCKER_REQUIRED_MESSAGE =
  'Docker is required to run the backend tests: start Docker and run again.';

async function startContainer() {
  try {
    return await new PostgreSqlContainer('postgres:16-alpine')
      .withStartupTimeout(CONTAINER_START_TIMEOUT_MS)
      .start();
  } catch (error) {
    const isDockerMissing =
      error instanceof Error && error.message.includes(NO_RUNTIME_ERROR);
    if (!isDockerMissing) throw error;
    throw new Error(DOCKER_REQUIRED_MESSAGE, { cause: error });
  }
}

async function createTemplateDatabase(adminUri: string): Promise<void> {
  const admin = await MikroORM.init({
    clientUrl: adminUri,
    entities: [],
    discovery: { warnWhenNoEntities: false },
  });
  try {
    await admin.em
      .getConnection()
      .execute(`CREATE DATABASE ${TEMPLATE_DATABASE}`);
  } finally {
    await admin.close(true);
  }
}

/** Runs the real migrations (the ones production uses) once, on the template. */
async function migrateTemplate(templateUri: string): Promise<void> {
  await execFileAsync('pnpm', ['exec', 'mikro-orm', 'migration:up'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      DATABASE_URL: templateUri,
      NODE_ENV: 'test',
      // The CLI would otherwise write a snapshot file for the template into src/.
      MIKRO_ORM_MIGRATIONS_SNAPSHOT: 'false',
      // Migrate from src/, never from a stale dist/ build.
      MIKRO_ORM_CLI_USE_TS_NODE: 'true',
    },
  });
}

export default async function globalSetup(): Promise<void> {
  const container = await startContainer();
  (globalThis as Record<string, unknown>).__TEST_POSTGRES_CONTAINER__ =
    container;

  try {
    const adminUri = container.getConnectionUri();
    await createTemplateDatabase(adminUri);
    await migrateTemplate(uriForDatabase(adminUri, TEMPLATE_DATABASE));
    process.env[TEST_POSTGRES_URI_ENV] = adminUri;
  } catch (error) {
    // Jest skips globalTeardown when set-up throws.
    await container.stop();
    throw error;
  }
}
