import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Quiz } from '@/db/entities/quiz.entity';
import {
  listTruncatableTables,
  useTestDatabase,
  workerDatabaseName,
} from '@/test-db/test-database';

const MIGRATIONS_TABLE = 'mikro_orm_migrations';

describe('test database', () => {
  const db = useTestDatabase();

  it("connects to this worker's database", async () => {
    const [row] = await db.orm.em
      .getConnection()
      .execute<{ name: string }[]>('SELECT current_database() AS name');

    expect(row.name).toBe(workerDatabaseName());
  });

  it('empties every table that exists in the entity definitions', () => {
    const entityTables = Object.values(db.orm.getMetadata().getAll())
      .filter((meta) => !meta.abstract && !meta.embeddable)
      .map((meta) => meta.tableName)
      .sort();

    expect(listTruncatableTables(db.orm)).toEqual(entityTables);
  });

  it('covers every table the migrations created', async () => {
    const rows = await db.orm.em
      .getConnection()
      .execute<{ table_name: string }[]>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name <> '${MIGRATIONS_TABLE}'`,
      );

    expect(listTruncatableTables(db.orm)).toEqual(
      rows.map((row) => row.table_name).sort(),
    );
  });

  it('starts a test with empty tables after the one before it inserted rows', async () => {
    const em = db.orm.em.fork();
    expect(await em.count(Quiz)).toBe(0);
    em.create(Quiz, { title: 'Leftover' });
    await em.flush();
    expect(await em.count(Quiz)).toBe(1);
  });

  it('starts the next test empty as well', async () => {
    expect(await db.orm.em.fork().count(Quiz)).toBe(0);
  });

  it('has applied exactly the migrations in src, not a stale build', async () => {
    const migrationFiles = readdirSync(join(__dirname, '../db/migrations'))
      .filter((file) => /^Migration.*\.ts$/.test(file))
      .map((file) => file.replace(/\.ts$/, ''))
      .sort();

    const rows = await db.orm.em
      .getConnection()
      .execute<{ name: string }[]>(`SELECT name FROM ${MIGRATIONS_TABLE}`);

    expect(rows.map((row) => row.name).sort()).toEqual(migrationFiles);
  });
});

describe('workerDatabaseName', () => {
  const saved = {
    jest: process.env.JEST_WORKER_ID,
    stryker: process.env.STRYKER_MUTATOR_WORKER,
  };

  function setEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  afterEach(() => {
    setEnv('JEST_WORKER_ID', saved.jest);
    setEnv('STRYKER_MUTATOR_WORKER', saved.stryker);
  });

  it('names the database after the Jest worker', () => {
    setEnv('STRYKER_MUTATOR_WORKER', undefined);
    setEnv('JEST_WORKER_ID', '3');

    expect(workerDatabaseName()).toBe('pubquiz_test_w3');
  });

  it('names it after the Stryker worker under Stryker, whose workers all have Jest worker 1', () => {
    setEnv('STRYKER_MUTATOR_WORKER', '5');
    setEnv('JEST_WORKER_ID', '1');

    expect(workerDatabaseName()).toBe('pubquiz_test_s5');
  });
});
