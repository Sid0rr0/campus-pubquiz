import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import * as schema from '@/db/schema';
import { GameProgressRepository } from '@/game/game-progress.repository';

describe('GameProgressRepository (Postgres integration)', () => {
  let container: StartedPostgreSqlContainer;
  let client: Client;
  let db: NodePgDatabase<typeof schema>;
  let repository: GameProgressRepository;
  let sessionId: string;

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

  beforeEach(async () => {
    repository = new GameProgressRepository(db);
    const [quiz] = await db
      .insert(schema.quizzes)
      .values({ title: 'Restart Resilience Quiz' })
      .returning();
    const [session] = await db
      .insert(schema.gameSessions)
      .values({ quizId: quiz.id, joinCode: 'ABCDEF' })
      .returning();
    sessionId = session.id;
  });

  afterEach(async () => {
    await client.query(
      'TRUNCATE answers, teams, game_sessions, questions, rounds, quizzes CASCADE',
    );
  });

  it('returns the default lobby progress for a freshly seeded session', async () => {
    const progress = await repository.load(sessionId);

    expect(progress).toEqual({
      status: 'lobby',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
    });
  });

  it('persists and reloads progress across a simulated restart', async () => {
    await repository.save(sessionId, {
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 2,
      isLeaderboardVisible: true,
    });

    const reloaded = await repository.load(sessionId);
    expect(reloaded).toEqual({
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 2,
      isLeaderboardVisible: true,
    });
  });

  it('returns null for a session that does not exist', async () => {
    const progress = await repository.load(
      '00000000-0000-0000-0000-000000000000',
    );
    expect(progress).toBeNull();
  });
});
