import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { MikroORM } from '@mikro-orm/postgresql';

const PREVIOUS_MIGRATION = 'Migration20260928120000_AddNameToGameSessions';
const QUESTION_POINTS = 10;

describe('AddVerdictToAnswers migration (Postgres integration)', () => {
  let container: StartedPostgreSqlContainer;
  let orm: MikroORM;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    orm = await MikroORM.init({
      clientUrl: container.getConnectionUri(),
      entities: ['./dist/db/entities/*.entity.js'],
      entitiesTs: ['./src/db/entities/*.entity.ts'],
      migrations: {
        path: './dist/db/migrations',
        pathTs: './src/db/migrations',
      },
    });
  }, 60_000);

  afterAll(async () => {
    await orm.close(true);
    await container.stop();
  });

  it('backfills graded answers from their points and leaves ungraded ones null', async () => {
    await orm.getMigrator().up({ to: PREVIOUS_MIGRATION });
    const connection = orm.em.getConnection();
    const [{ id: quizId }] = await connection.execute(
      `insert into quizzes (title, created_at, updated_at) values ('Quiz', now(), now()) returning id`,
    );
    const [{ id: roundId }] = await connection.execute(
      `insert into rounds (quiz_id, title, order_index, created_at, updated_at) values (${quizId}, 'Round', 0, now(), now()) returning id`,
    );
    const [{ id: questionId }] = await connection.execute(
      `insert into questions (round_id, order_index, type, prompt, answer, points, payload, created_at, updated_at)
       values (${roundId}, 0, 'multiple_choice', 'Q?', 'A', ${QUESTION_POINTS}, '{}', now(), now()) returning id`,
    );
    const [{ id: sessionId }] = await connection.execute(
      `insert into game_sessions (quiz_id, join_code, created_at, updated_at) values (${quizId}, 'ABCDEF', now(), now()) returning id`,
    );
    const cases: Array<[string, number, boolean]> = [
      ['full', QUESTION_POINTS, true],
      ['above', QUESTION_POINTS + 5, true],
      ['between', 3, true],
      ['zero', 0, true],
      ['ungraded', 0, false],
    ];
    for (const [name, points, isGraded] of cases) {
      const [{ id: teamId }] = await connection.execute(
        `insert into teams (name, token, code, created_at, updated_at) values ('${name}', 'token-${name}', 'code-${name}', now(), now()) returning id`,
      );
      await connection.execute(
        `insert into answers (game_session_id, question_id, team_id, value, points_awarded, graded_at, created_at, updated_at)
         values (${sessionId}, ${questionId}, ${teamId}, 'v', ${points}, ${isGraded ? 'now()' : 'null'}, now(), now())`,
      );
    }

    await orm.getMigrator().up();

    const rows: Array<{ name: string; verdict: string | null }> =
      await connection.execute(
        `select t.name, a.verdict from answers a join teams t on t.id = a.team_id order by t.name`,
      );
    expect(Object.fromEntries(rows.map((r) => [r.name, r.verdict]))).toEqual({
      above: 'correct',
      between: 'partial',
      full: 'correct',
      ungraded: null,
      zero: 'incorrect',
    });
  });
});
