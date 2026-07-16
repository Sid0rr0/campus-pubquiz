import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import { Client } from 'pg';
import * as schema from '@/db/schema';

describe('Drizzle schema (Postgres integration)', () => {
  let container: StartedPostgreSqlContainer;
  let client: Client;
  let db: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    client = new Client({ connectionString: container.getConnectionUri() });
    await client.connect();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: './drizzle' });
  }, 60_000);

  afterAll(async () => {
    await client.end();
    await container.stop();
  });

  afterEach(async () => {
    // last-write-wins over FK order: children first
    await client.query(
      'TRUNCATE answers, teams, game_sessions, questions, rounds, quizzes CASCADE',
    );
  });

  it('persists the full authoring chain: quiz -> round (with breakAfter) -> question', async () => {
    const [quiz] = await db
      .insert(schema.quizzes)
      .values({ title: 'Campus Pub Quiz Night' })
      .returning();
    const [round] = await db
      .insert(schema.rounds)
      .values({
        quizId: quiz.id,
        title: 'Round 2',
        orderIndex: 1,
        breakAfter: true,
      })
      .returning();
    const [question] = await db
      .insert(schema.questions)
      .values({
        roundId: round.id,
        orderIndex: 0,
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        payload: {
          options: ['Paris', 'London', 'Berlin', 'Rome'],
          answer: 'Paris',
        },
        points: 2,
      })
      .returning();

    expect(round.breakAfter).toBe(true);
    expect(question.payload).toEqual({
      options: ['Paris', 'London', 'Berlin', 'Rome'],
      answer: 'Paris',
    });
  });

  it('persists the full runtime chain: game session -> team -> answer', async () => {
    const [quiz] = await db
      .insert(schema.quizzes)
      .values({ title: 'Runtime Quiz' })
      .returning();
    const [round] = await db
      .insert(schema.rounds)
      .values({
        quizId: quiz.id,
        title: 'Round 1',
        orderIndex: 0,
        breakAfter: false,
      })
      .returning();
    const [question] = await db
      .insert(schema.questions)
      .values({
        roundId: round.id,
        orderIndex: 0,
        type: 'free_text',
        prompt: 'Name a fruit',
        points: 1,
      })
      .returning();
    const [session] = await db
      .insert(schema.gameSessions)
      .values({ quizId: quiz.id, joinCode: 'ABCD' })
      .returning();
    const [team] = await db
      .insert(schema.teams)
      .values({
        gameSessionId: session.id,
        name: 'The Quizzards',
        token: 'team-token-1',
      })
      .returning();
    const [answer] = await db
      .insert(schema.answers)
      .values({
        gameSessionId: session.id,
        questionId: question.id,
        teamId: team.id,
        value: 'Banana',
      })
      .returning();

    const [found] = await db
      .select()
      .from(schema.answers)
      .where(eq(schema.answers.id, answer.id));
    expect(found.value).toBe('Banana');
    expect(found.teamId).toBe(team.id);
  });

  it('rejects an answer for a team that does not exist (referential integrity)', async () => {
    const [quiz] = await db
      .insert(schema.quizzes)
      .values({ title: 'FK Quiz' })
      .returning();
    const [round] = await db
      .insert(schema.rounds)
      .values({
        quizId: quiz.id,
        title: 'Round 1',
        orderIndex: 0,
        breakAfter: false,
      })
      .returning();
    const [question] = await db
      .insert(schema.questions)
      .values({
        roundId: round.id,
        orderIndex: 0,
        type: 'free_text',
        prompt: 'Q',
        points: 1,
      })
      .returning();
    const [session] = await db
      .insert(schema.gameSessions)
      .values({ quizId: quiz.id, joinCode: 'FKFK' })
      .returning();

    await expect(
      db.insert(schema.answers).values({
        gameSessionId: session.id,
        questionId: question.id,
        teamId: '00000000-0000-0000-0000-000000000000',
        value: 'anything',
      }),
    ).rejects.toThrow();
  });

  it('supports last-write-wins revision via upsert on (session, question, team)', async () => {
    const [quiz] = await db
      .insert(schema.quizzes)
      .values({ title: 'Revise Quiz' })
      .returning();
    const [round] = await db
      .insert(schema.rounds)
      .values({
        quizId: quiz.id,
        title: 'Round 1',
        orderIndex: 0,
        breakAfter: false,
      })
      .returning();
    const [question] = await db
      .insert(schema.questions)
      .values({
        roundId: round.id,
        orderIndex: 0,
        type: 'free_text',
        prompt: 'Q',
        points: 1,
      })
      .returning();
    const [session] = await db
      .insert(schema.gameSessions)
      .values({ quizId: quiz.id, joinCode: 'REVI' })
      .returning();
    const [team] = await db
      .insert(schema.teams)
      .values({
        gameSessionId: session.id,
        name: 'Revisers',
        token: 'team-token-2',
      })
      .returning();

    await db.insert(schema.answers).values({
      gameSessionId: session.id,
      questionId: question.id,
      teamId: team.id,
      value: 'First answer',
    });

    await db
      .insert(schema.answers)
      .values({
        gameSessionId: session.id,
        questionId: question.id,
        teamId: team.id,
        value: 'Revised answer',
      })
      .onConflictDoUpdate({
        target: [
          schema.answers.gameSessionId,
          schema.answers.questionId,
          schema.answers.teamId,
        ],
        set: { value: 'Revised answer', updatedAt: new Date() },
      });

    const rows = await db
      .select()
      .from(schema.answers)
      .where(eq(schema.answers.gameSessionId, session.id));

    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe('Revised answer');
  });
});
