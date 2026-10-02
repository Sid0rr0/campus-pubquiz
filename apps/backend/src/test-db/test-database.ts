import { MikroORM } from '@mikro-orm/postgresql';
import {
  TEMPLATE_DATABASE,
  TEST_POSTGRES_URI_ENV,
  uriForDatabase,
} from '@/test-db/test-db-env';

const CONNECT_TIMEOUT_MS = 60_000;
/** Postgres refuses to clone a template while another clone is reading it. */
const TEMPLATE_IN_USE_CODE = '55006';
const CLONE_RETRY_LIMIT = 50;
const CLONE_RETRY_DELAY_MS = 100;

export interface TestDatabase {
  /** Connected to this Jest worker's database, migrated and empty at the start of every test. */
  readonly orm: MikroORM;
}

/** Tables to empty between tests: every concrete entity's table, straight from the metadata. */
export function listTruncatableTables(orm: MikroORM): string[] {
  return Object.values(orm.getMetadata().getAll())
    .filter((meta) => !meta.abstract && !meta.embeddable)
    .map((meta) => meta.tableName)
    .sort();
}

function workerDatabaseName(): string {
  return `pubquiz_test_w${process.env.JEST_WORKER_ID ?? '1'}`;
}

function requireBaseUri(): string {
  const uri = process.env[TEST_POSTGRES_URI_ENV];
  if (!uri) {
    throw new Error(
      `${TEST_POSTGRES_URI_ENV} is not set: the backend Jest config's global set-up did not run.`,
    );
  }
  return uri;
}

/** First use on a worker clones the template; later spec files on that worker reuse the database. */
async function ensureWorkerDatabase(baseUri: string, name: string) {
  const admin = await MikroORM.init({
    clientUrl: baseUri,
    entities: [],
    discovery: { warnWhenNoEntities: false },
  });
  try {
    const connection = admin.em.getConnection();
    const existing = await connection.execute(
      'SELECT 1 FROM pg_database WHERE datname = ?',
      [name],
    );
    if (existing.length > 0) return;
    for (let attempt = 1; ; attempt++) {
      try {
        await connection.execute(
          `CREATE DATABASE ${name} TEMPLATE ${TEMPLATE_DATABASE}`,
        );
        return;
      } catch (error) {
        const isTemplateBusy =
          (error as { code?: string }).code === TEMPLATE_IN_USE_CODE;
        if (!isTemplateBusy || attempt >= CLONE_RETRY_LIMIT) throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, CLONE_RETRY_DELAY_MS),
        );
      }
    }
  } finally {
    await admin.close(true);
  }
}

/**
 * The one way a backend spec gets a database. Call inside a top-level
 * `describe`: connects before the file, empties every entity table after each
 * test and closes the connection after the file.
 */
export function useTestDatabase(): TestDatabase {
  let orm: MikroORM | undefined;

  beforeAll(async () => {
    const baseUri = requireBaseUri();
    const name = workerDatabaseName();
    await ensureWorkerDatabase(baseUri, name);
    orm = await MikroORM.init({
      clientUrl: uriForDatabase(baseUri, name),
      entities: ['./dist/db/entities/*.entity.js'],
      entitiesTs: ['./src/db/entities/*.entity.ts'],
    });
  }, CONNECT_TIMEOUT_MS);

  afterEach(async () => {
    if (!orm) return;
    const tables = listTruncatableTables(orm).join(', ');
    await orm.em.getConnection().execute(`TRUNCATE ${tables} CASCADE`);
  });

  afterAll(async () => {
    await orm?.close(true);
  });

  return {
    get orm() {
      if (!orm) {
        throw new Error('useTestDatabase().orm used before beforeAll ran');
      }
      return orm;
    },
  };
}
