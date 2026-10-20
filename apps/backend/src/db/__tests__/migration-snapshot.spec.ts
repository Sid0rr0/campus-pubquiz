import { MikroORM } from '@mikro-orm/postgresql';
import config from '@/mikro-orm.config';
import { useTestDatabase } from '@/test-db/test-database';

const INIT_TIMEOUT_MS = 120_000;

/**
 * `db:migrate:create` diffs the entities against the tracked snapshot, so a
 * snapshot that lags the entities makes the next migration recreate tables
 * that already exist. Fails on an entity change committed without running
 * `db:migrate:create`, or a snapshot rewritten from a live database.
 */
describe('the migration snapshot', () => {
  const db = useTestDatabase();

  it(
    'matches the entities, so a new migration holds only the new change',
    async () => {
      const orm = await MikroORM.init({
        ...config,
        clientUrl: db.orm.config.getClientUrl(),
        debug: false,
      });
      try {
        expect(await orm.migrator.checkMigrationNeeded()).toBe(false);
      } finally {
        await orm.close(true);
      }
    },
    INIT_TIMEOUT_MS,
  );
});
