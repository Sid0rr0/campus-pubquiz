import { useUnmigratedTestDatabase } from '@/test-db/test-database';

describe('useUnmigratedTestDatabase', () => {
  const db = useUnmigratedTestDatabase();

  it('starts with no tables until the spec migrates', async () => {
    const connection = db.orm.em.getConnection();
    const tablesBefore = await connection.execute(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    expect(tablesBefore).toHaveLength(0);

    await db.orm.getMigrator().up();

    const tablesAfter = await connection.execute(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'quizzes'`,
    );
    expect(tablesAfter).toHaveLength(1);
  });
});
