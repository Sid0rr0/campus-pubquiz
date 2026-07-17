import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import { HARDCODED_QUIZ } from '@/game/hardcoded-quiz.fixture';
import * as schema from '@/db/schema';
import { SeedService } from '@/db/seed.service';

describe('SeedService (Postgres integration)', () => {
  let container: StartedPostgreSqlContainer;
  let client: Client;
  let db: NodePgDatabase<typeof schema>;
  let seedService: SeedService;

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

  beforeEach(() => {
    seedService = new SeedService(db);
  });

  afterEach(async () => {
    await client.query(
      'TRUNCATE answers, teams, game_sessions, questions, rounds, quizzes CASCADE',
    );
  });

  it('creates the quiz/rounds/questions/session from the hardcoded fixture on first seed', async () => {
    const result = await seedService.seed();

    expect(result.rounds).toHaveLength(HARDCODED_QUIZ.rounds.length);
    result.rounds.forEach((round, roundIndex) => {
      expect(round.questions).toHaveLength(
        HARDCODED_QUIZ.rounds[roundIndex].questions.length,
      );
      expect(round.breakAfter).toBe(
        HARDCODED_QUIZ.rounds[roundIndex].breakAfter,
      );
    });
    expect(result.joinCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    const quizzesInDb = await db.select().from(schema.quizzes);
    expect(quizzesInDb).toHaveLength(1);
  });

  it('assigns real UUIDs to every seeded round and question', async () => {
    const result = await seedService.seed();
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    expect(result.quizId).toMatch(uuidPattern);
    for (const round of result.rounds) {
      expect(round.id).toMatch(uuidPattern);
      for (const question of round.questions) {
        expect(question.id).toMatch(uuidPattern);
      }
    }
  });

  it('is idempotent: seeding twice does not duplicate rows and returns the same ids', async () => {
    const first = await seedService.seed();
    const second = await seedService.seed();

    expect(second).toEqual(first);

    const quizzesInDb = await db.select().from(schema.quizzes);
    const sessionsInDb = await db.select().from(schema.gameSessions);
    expect(quizzesInDb).toHaveLength(1);
    expect(sessionsInDb).toHaveLength(1);
  });

  it('creates a fresh game session with a new join code for a quiz', async () => {
    const first = await seedService.seed();

    const session = await seedService.createSession(first.quizId);

    expect(session.gameSessionId).not.toBe(first.gameSessionId);
    expect(session.joinCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(session.joinCode).not.toBe(first.joinCode);

    const sessionsInDb = await db.select().from(schema.gameSessions);
    expect(sessionsInDb).toHaveLength(2);
  });

  it('resumes the most recently created game session on seed after a restart', async () => {
    const first = await seedService.seed();
    const [newerSession] = await db
      .insert(schema.gameSessions)
      .values({
        quizId: first.quizId,
        joinCode: 'ZZZZZZ',
        createdAt: new Date(Date.now() + 60_000),
      })
      .returning();

    const resumed = await new SeedService(db).seed();

    expect(resumed.gameSessionId).toBe(newerSession.id);
    expect(resumed.joinCode).toBe('ZZZZZZ');
  });

  it('preserves question content (prompt, type, options, points) from the fixture', async () => {
    const result = await seedService.seed();
    const firstQuestion = result.rounds[0].questions[0];
    const fixtureQuestion = HARDCODED_QUIZ.rounds[0].questions[0];

    expect(firstQuestion.prompt).toBe(fixtureQuestion.prompt);
    expect(firstQuestion.type).toBe(fixtureQuestion.type);
    expect(firstQuestion.options).toEqual(fixtureQuestion.options);
    expect(firstQuestion.points).toBe(fixtureQuestion.points);
  });
});
