import { useUnmigratedTestDatabase } from '@/test-db/test-database';

const PREVIOUS_MIGRATION = 'Migration20261107120000_RenameKahootToQuickfire';

describe('MoveQuickfireToQuizMode migration (Postgres integration)', () => {
  const db = useUnmigratedTestDatabase();

  async function insertQuiz(title: string, roundIsQuickfire: boolean[]) {
    const connection = db.orm.em.getConnection();
    const [{ id: quizId }] = await connection.execute(
      `insert into quizzes (title, created_at, updated_at) values ('${title}', now(), now()) returning id`,
    );
    for (const [index, isQuickfire] of roundIsQuickfire.entries()) {
      await connection.execute(
        `insert into rounds (quiz_id, title, order_index, quickfire, created_at, updated_at) values (${quizId}, 'Round', ${index}, ${isQuickfire}, now(), now())`,
      );
    }
  }

  it('makes an all-quickfire quiz quickfire and every other quiz pub, throws on a mixed quiz, then drops the round flag', async () => {
    await db.orm.getMigrator().up({ to: PREVIOUS_MIGRATION });
    const connection = db.orm.em.getConnection();
    await insertQuiz('allQuickfire', [true, true]);
    await insertQuiz('allPub', [false, false]);
    await insertQuiz('noRounds', []);
    await insertQuiz('mixed', [true, false]);

    await expect(db.orm.getMigrator().up()).rejects.toThrow(
      /mixes quickfire and pub rounds/,
    );

    await connection.execute(`delete from quizzes where title = 'mixed'`);
    await db.orm.getMigrator().up();

    const rows: Array<{ title: string; mode: string }> =
      await connection.execute(`select title, mode from quizzes`);
    expect(Object.fromEntries(rows.map((r) => [r.title, r.mode]))).toEqual({
      allQuickfire: 'quickfire',
      allPub: 'pub',
      noRounds: 'pub',
    });
    const columns: Array<{ column_name: string }> = await connection.execute(
      `select column_name from information_schema.columns where table_name = 'rounds'`,
    );
    expect(columns.map((c) => c.column_name)).not.toContain('quickfire');
  });
});
