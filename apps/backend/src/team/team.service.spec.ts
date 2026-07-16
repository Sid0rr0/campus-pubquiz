import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import * as schema from '../db/schema';
import { TeamNameTakenError, TeamService } from './team.service';

describe('TeamService (Postgres integration)', () => {
  let container: StartedPostgreSqlContainer;
  let client: Client;
  let db: NodePgDatabase<typeof schema>;
  let teamService: TeamService;
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
    teamService = new TeamService(db);
    const [quiz] = await db
      .insert(schema.quizzes)
      .values({ title: 'Team Test Quiz' })
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

  it('creates a new team with a generated token', async () => {
    const team = await teamService.join(sessionId, 'The Quizzards');

    expect(team.name).toBe('The Quizzards');
    expect(team.token).toEqual(expect.any(String));
    expect(team.token.length).toBeGreaterThan(10);
  });

  it('restores the same team when rejoining with a valid token', async () => {
    const created = await teamService.join(sessionId, 'The Quizzards');
    const rejoined = await teamService.join(
      sessionId,
      'ignored name',
      created.token,
    );

    expect(rejoined.id).toBe(created.id);
    expect(rejoined.name).toBe('The Quizzards');

    const rows = await db.select().from(schema.teams);
    expect(rows).toHaveLength(1);
  });

  it('rejects a duplicate team name within the same session', async () => {
    await teamService.join(sessionId, 'The Quizzards');

    await expect(teamService.join(sessionId, 'The Quizzards')).rejects.toThrow(
      TeamNameTakenError,
    );
  });

  it('allows the same team name in two different sessions', async () => {
    const [quiz2] = await db
      .insert(schema.quizzes)
      .values({ title: 'Second Quiz' })
      .returning();
    const [session2] = await db
      .insert(schema.gameSessions)
      .values({ quizId: quiz2.id, joinCode: 'GHIJKL' })
      .returning();

    await teamService.join(sessionId, 'The Quizzards');
    const teamInSecondSession = await teamService.join(
      session2.id,
      'The Quizzards',
    );

    expect(teamInSecondSession.name).toBe('The Quizzards');
  });
});
