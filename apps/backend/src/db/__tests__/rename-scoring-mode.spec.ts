import { useUnmigratedTestDatabase } from '@/test-db/test-database';

const PREVIOUS_MIGRATION = 'Migration20261026104534_AddClosedAtToGameSessions';

describe('RenameScoringMode migration (Postgres integration)', () => {
  const db = useUnmigratedTestDatabase();

  it('renames the match scoring setting and its values and leaves other questions alone', async () => {
    await db.orm.getMigrator().up({ to: PREVIOUS_MIGRATION });
    const connection = db.orm.em.getConnection();
    const [{ id: quizId }] = await connection.execute(
      `insert into quizzes (title, created_at, updated_at) values ('Quiz', now(), now()) returning id`,
    );
    const [{ id: roundId }] = await connection.execute(
      `insert into rounds (quiz_id, title, order_index, created_at, updated_at) values (${quizId}, 'Round', 0, now(), now()) returning id`,
    );
    const seed = [
      [
        'matchPartial',
        'match',
        { matchScoringMode: 'partial', options: ['a'] },
      ],
      ['matchAllOrNothing', 'match', { matchScoringMode: 'all_or_nothing' }],
      ['matchUnset', 'match', { options: ['a'] }],
      ['sortQ', 'sort', { options: ['a', 'b'] }],
      ['freeTextQ', 'free_text', { mediaUrl: 'https://example.com/a.png' }],
    ] as const;
    for (const [index, [name, type, payload]] of seed.entries()) {
      await connection.execute(
        `insert into questions (round_id, order_index, type, prompt, answer, points, payload, created_at, updated_at)
         values (${roundId}, ${index}, '${type}', '${name}', 'A', 10, '${JSON.stringify(payload)}'::jsonb, now(), now())`,
      );
    }

    await db.orm.getMigrator().up();

    const rows: Array<{ prompt: string; payload: Record<string, unknown> }> =
      await connection.execute(
        `select prompt, payload from questions order by order_index`,
      );
    const byName = Object.fromEntries(rows.map((r) => [r.prompt, r.payload]));

    expect(byName.matchPartial).toEqual({
      scoringMode: 'per_item',
      options: ['a'],
    });
    expect(byName.matchAllOrNothing).toEqual({ scoringMode: 'one_off' });
    expect(byName.matchUnset).toEqual({ options: ['a'] });
    expect(byName.sortQ).toEqual({ options: ['a', 'b'] });
    expect(byName.freeTextQ).toEqual({ mediaUrl: 'https://example.com/a.png' });
  });
});
