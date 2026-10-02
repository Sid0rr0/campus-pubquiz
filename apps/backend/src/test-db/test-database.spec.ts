import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Quiz } from '@/db/entities/quiz.entity';
import {
  listTruncatableTables,
  useTestDatabase,
} from '@/test-db/test-database';

const MIGRATIONS_TABLE = 'mikro_orm_migrations';

describe('test database', () => {
  const db = useTestDatabase();

  it('gives each Jest worker its own database', async () => {
    const [row] = await db.orm.em
      .getConnection()
      .execute<{ name: string }[]>('SELECT current_database() AS name');

    expect(row.name).toBe(`pubquiz_test_w${process.env.JEST_WORKER_ID}`);
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
