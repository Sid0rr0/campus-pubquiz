import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import * as schema from '@/db/schema';
import {
  InvalidJoinCodeError,
  TeamNameTakenError,
  TeamService,
} from '@/team/team.service';

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

  async function createSecondSession(joinCode: string): Promise<string> {
    const [quiz] = await db
      .insert(schema.quizzes)
      .values({ title: 'Second Quiz' })
      .returning();
    const [session] = await db
      .insert(schema.gameSessions)
      .values({ quizId: quiz.id, joinCode })
      .returning();
    return session.id;
  }

  it('creates a new team with a generated token when the join code matches', async () => {
    const team = await teamService.join(sessionId, 'The Quizzards', {
      joinCode: 'ABCDEF',
    });

    expect(team.name).toBe('The Quizzards');
    expect(team.token).toEqual(expect.any(String));
    expect(team.token.length).toBeGreaterThan(10);
  });

  it('accepts a join code regardless of casing and surrounding whitespace', async () => {
    const team = await teamService.join(sessionId, 'The Quizzards', {
      joinCode: '  abcdef ',
    });

    expect(team.name).toBe('The Quizzards');
  });

  it('rejects a new registration with a wrong join code', async () => {
    await expect(
      teamService.join(sessionId, 'The Quizzards', { joinCode: 'WRONG1' }),
    ).rejects.toThrow(InvalidJoinCodeError);

    const rows = await db.select().from(schema.teams);
    expect(rows).toHaveLength(0);
  });

  it('rejects a new registration with no join code at all', async () => {
    await expect(
      teamService.join(sessionId, 'The Quizzards', {}),
    ).rejects.toThrow(InvalidJoinCodeError);
  });

  it('restores the same team when rejoining with a valid token and no join code', async () => {
    const created = await teamService.join(sessionId, 'The Quizzards', {
      joinCode: 'ABCDEF',
    });
    const rejoined = await teamService.join(sessionId, 'ignored name', {
      teamToken: created.token,
    });

    expect(rejoined.id).toBe(created.id);
    expect(rejoined.name).toBe('The Quizzards');

    const rows = await db.select().from(schema.teams);
    expect(rows).toHaveLength(1);
  });

  it('rejects a duplicate team name within the same session', async () => {
    await teamService.join(sessionId, 'The Quizzards', { joinCode: 'ABCDEF' });

    await expect(
      teamService.join(sessionId, 'The Quizzards', { joinCode: 'ABCDEF' }),
    ).rejects.toThrow(TeamNameTakenError);
  });

  it('creates a fresh team when the token belongs to a different session and the new code matches', async () => {
    const original = await teamService.join(sessionId, 'The Quizzards', {
      joinCode: 'ABCDEF',
    });
    const session2Id = await createSecondSession('GHIJKL');

    const rejoined = await teamService.join(session2Id, 'The Quizzards', {
      teamToken: original.token,
      joinCode: 'GHIJKL',
    });

    expect(rejoined.id).not.toBe(original.id);
    expect(rejoined.token).not.toBe(original.token);

    const rows = await db.select().from(schema.teams);
    expect(rows).toHaveLength(2);
  });

  it('rejects a stale token from another session when the join code is also stale', async () => {
    const original = await teamService.join(sessionId, 'The Quizzards', {
      joinCode: 'ABCDEF',
    });
    const session2Id = await createSecondSession('GHIJKL');

    await expect(
      teamService.join(session2Id, 'The Quizzards', {
        teamToken: original.token,
        joinCode: 'ABCDEF',
      }),
    ).rejects.toThrow(InvalidJoinCodeError);
  });

  it('lists only the teams of the given session in join order', async () => {
    const session2Id = await createSecondSession('GHIJKL');
    const first = await teamService.join(sessionId, 'First Team', {
      joinCode: 'ABCDEF',
    });
    const second = await teamService.join(sessionId, 'Second Team', {
      joinCode: 'ABCDEF',
    });
    await teamService.join(session2Id, 'Other Session Team', {
      joinCode: 'GHIJKL',
    });

    const teams = await teamService.listForSession(sessionId);

    expect(teams).toEqual([
      { teamId: first.id, teamName: 'First Team' },
      { teamId: second.id, teamName: 'Second Team' },
    ]);
  });

  it('allows the same team name in two different sessions', async () => {
    const session2Id = await createSecondSession('GHIJKL');

    await teamService.join(sessionId, 'The Quizzards', { joinCode: 'ABCDEF' });
    const teamInSecondSession = await teamService.join(
      session2Id,
      'The Quizzards',
      { joinCode: 'GHIJKL' },
    );

    expect(teamInSecondSession.name).toBe('The Quizzards');
  });
});
