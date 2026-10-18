import { useUnmigratedTestDatabase } from '@/test-db/test-database';

const PREVIOUS_MIGRATION = 'Migration20261016094243_AllowHalfStarRoundRatings';

interface QuestionRow {
  type: string;
  payload: Record<string, unknown>;
}

const MEDIA_FIELDS = {
  mediaUrl: 'https://example.com/clip.mp3',
  answerMediaUrl: 'https://example.com/reveal.jpg',
  mediaStartSeconds: 5,
  mediaEndSeconds: 20,
  revealStartSeconds: 30,
  revealEndSeconds: 40,
  isVideoHidden: true,
};

describe('RetypeMediaQuestions migration (Postgres integration)', () => {
  const db = useUnmigratedTestDatabase();

  it('re-types audio and youtube questions and keeps payload media and answer grades', async () => {
    await db.orm.getMigrator().up({ to: PREVIOUS_MIGRATION });
    const connection = db.orm.em.getConnection();
    const [{ id: quizId }] = await connection.execute(
      `insert into quizzes (title, created_at, updated_at) values ('Quiz', now(), now()) returning id`,
    );
    const [{ id: roundId }] = await connection.execute(
      `insert into rounds (quiz_id, title, order_index, created_at, updated_at) values (${quizId}, 'Round', 0, now(), now()) returning id`,
    );
    const insertQuestion = async (
      name: string,
      type: string,
      payload: Record<string, unknown>,
      orderIndex: number,
    ): Promise<number> => {
      const [{ id }]: Array<{ id: number }> = await connection.execute(
        `insert into questions (round_id, order_index, type, prompt, answer, points, payload, created_at, updated_at)
         values (${roundId}, ${orderIndex}, '${type}', '${name}', 'A', 10, '${JSON.stringify(payload)}'::jsonb, now(), now()) returning id`,
      );
      return id;
    };
    const audioNoOptionsId = await insertQuestion(
      'audioNoOptions',
      'audio',
      MEDIA_FIELDS,
      0,
    );
    await insertQuestion(
      'youtubeEmptyOptions',
      'youtube',
      { ...MEDIA_FIELDS, options: [] },
      1,
    );
    await insertQuestion(
      'youtubeBlankOptions',
      'youtube',
      { ...MEDIA_FIELDS, options: ['', '  '] },
      2,
    );
    await insertQuestion(
      'audioWithOptions',
      'audio',
      { ...MEDIA_FIELDS, options: ['Queen', 'Abba'] },
      3,
    );
    await insertQuestion('numberQ', 'number', { margin: 2 }, 4);
    await insertQuestion('freeTextQ', 'free_text', {}, 5);

    const [{ id: sessionId }] = await connection.execute(
      `insert into game_sessions (quiz_id, join_code, created_at, updated_at) values (${quizId}, 'ABCDEF', now(), now()) returning id`,
    );
    const [{ id: teamId }] = await connection.execute(
      `insert into teams (name, token, code, created_at, updated_at) values ('t', 'token-t', 'code-t', now(), now()) returning id`,
    );
    await connection.execute(
      `insert into answers (game_session_id, question_id, team_id, value, points_awarded, verdict, graded_at, created_at, updated_at)
       values (${sessionId}, ${audioNoOptionsId}, ${teamId}, 'v', 7, 'partial', now(), now(), now())`,
    );

    await db.orm.getMigrator().up();

    const rows: Array<QuestionRow & { prompt: string }> =
      await connection.execute(
        `select prompt, type, payload from questions order by order_index`,
      );
    const byName = Object.fromEntries(rows.map((r) => [r.prompt, r]));

    expect(byName.audioNoOptions.type).toBe('free_text');
    expect(byName.audioNoOptions.payload).toEqual(MEDIA_FIELDS);
    expect(byName.youtubeEmptyOptions.type).toBe('free_text');
    expect(byName.youtubeEmptyOptions.payload).toEqual(MEDIA_FIELDS);
    expect(byName.youtubeEmptyOptions.payload).not.toHaveProperty('options');
    expect(byName.youtubeBlankOptions.type).toBe('free_text');
    expect(byName.youtubeBlankOptions.payload).toEqual(MEDIA_FIELDS);
    expect(byName.audioWithOptions.type).toBe('multiple_choice');
    expect(byName.audioWithOptions.payload).toEqual({
      ...MEDIA_FIELDS,
      options: ['Queen', 'Abba'],
    });
    expect(byName.numberQ).toMatchObject({
      type: 'number',
      payload: { margin: 2 },
    });
    expect(byName.freeTextQ).toMatchObject({ type: 'free_text', payload: {} });

    const [answer]: Array<{
      points_awarded: number;
      verdict: string;
      graded_at: Date | null;
    }> = await connection.execute(
      `select points_awarded, verdict, graded_at from answers`,
    );
    expect(answer.points_awarded).toBe(7);
    expect(answer.verdict).toBe('partial');
    expect(answer.graded_at).not.toBeNull();
  });
});
