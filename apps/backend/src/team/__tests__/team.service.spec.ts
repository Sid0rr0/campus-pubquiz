import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { MikroORM, type EntityManager } from '@mikro-orm/postgresql';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Team } from '@/db/entities/team.entity';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { TeamRepository } from '@/db/repositories/team.repository';
import {
  InvalidJoinCodeError,
  TeamCodeRequiredError,
  TeamService,
} from '@/team/team.service';

describe('TeamService (Postgres integration)', () => {
  let container: StartedPostgreSqlContainer;
  let orm: MikroORM;
  let em: EntityManager;
  let teamService: TeamService;
  let sessionId: number;

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
    await orm.getMigrator().up();
  }, 60_000);

  afterAll(async () => {
    await orm.close(true);
    await container.stop();
  });

  beforeEach(async () => {
    em = orm.em.fork();
    teamService = new TeamService(
      em.getRepository<Team, TeamRepository>(Team),
      em.getRepository<GameSession, GameSessionRepository>(GameSession),
      em.getRepository<GameSessionTeam, GameSessionTeamRepository>(
        GameSessionTeam,
      ),
    );
    const quiz = em.create(Quiz, { title: 'Team Test Quiz' });
    const session = em.create(GameSession, { quiz, joinCode: 'ABCDEF' });
    await em.flush();
    sessionId = session.id;
  });

  afterEach(async () => {
    await em
      .getConnection()
      .execute(
        'TRUNCATE answers, game_session_teams, teams, game_sessions, questions, rounds, quizzes CASCADE',
      );
  });

  async function createSecondSession(joinCode: string): Promise<number> {
    const quiz = em.create(Quiz, { title: 'Second Quiz' });
    const session = em.create(GameSession, { quiz, joinCode });
    await em.flush();
    return session.id;
  }

  it('creates a new team with a generated token and code when the join code matches', async () => {
    const team = await teamService.join(sessionId, 'The Quizzards', {
      joinCode: 'ABCDEF',
    });

    expect(team.name).toBe('The Quizzards');
    expect(team.token).toEqual(expect.any(String));
    expect(team.token.length).toBeGreaterThan(10);
    expect(team.code).toMatch(/^[A-Z]+-[A-Z]+-[A-Z]+$/);
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

    const rows = await em.find(Team, {});
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

    const rows = await em.find(Team, {});
    expect(rows).toHaveLength(1);
  });

  it('requires the team code to join under an existing name', async () => {
    await teamService.join(sessionId, 'The Quizzards', { joinCode: 'ABCDEF' });

    await expect(
      teamService.join(sessionId, 'The Quizzards', { joinCode: 'ABCDEF' }),
    ).rejects.toThrow(TeamCodeRequiredError);

    const rows = await em.find(Team, {});
    expect(rows).toHaveLength(1);
  });

  it('lets a second device join the same team in the same session given the correct team code', async () => {
    const created = await teamService.join(sessionId, 'The Quizzards', {
      joinCode: 'ABCDEF',
    });

    const secondDevice = await teamService.join(sessionId, 'The Quizzards', {
      joinCode: 'ABCDEF',
      teamCode: created.code,
    });

    expect(secondDevice.id).toBe(created.id);
    expect(secondDevice.token).toBe(created.token);

    const rows = await em.find(GameSessionTeam, {});
    expect(rows).toHaveLength(1);
  });

  it('reuses the same team across sessions when the token is valid and the new session join code matches', async () => {
    const original = await teamService.join(sessionId, 'The Quizzards', {
      joinCode: 'ABCDEF',
    });
    const session2Id = await createSecondSession('GHIJKL');

    const rejoined = await teamService.join(session2Id, 'The Quizzards', {
      teamToken: original.token,
      joinCode: 'GHIJKL',
    });

    expect(rejoined.id).toBe(original.id);
    expect(rejoined.token).toBe(original.token);

    const rows = await em.find(Team, {});
    expect(rows).toHaveLength(1);

    const roster = await em.find(GameSessionTeam, {});
    expect(roster).toHaveLength(2);
  });

  it('reuses the same team across sessions when the correct team code is given', async () => {
    const original = await teamService.join(sessionId, 'The Quizzards', {
      joinCode: 'ABCDEF',
    });
    const session2Id = await createSecondSession('GHIJKL');

    const rejoined = await teamService.join(session2Id, 'The Quizzards', {
      joinCode: 'GHIJKL',
      teamCode: original.code,
    });

    expect(rejoined.id).toBe(original.id);

    const rows = await em.find(Team, {});
    expect(rows).toHaveLength(1);
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

  it('rejects a duplicate team name in a different session without the team code', async () => {
    const session2Id = await createSecondSession('GHIJKL');

    await teamService.join(sessionId, 'The Quizzards', { joinCode: 'ABCDEF' });

    await expect(
      teamService.join(session2Id, 'The Quizzards', { joinCode: 'GHIJKL' }),
    ).rejects.toThrow(TeamCodeRequiredError);

    const rows = await em.find(Team, {});
    expect(rows).toHaveLength(1);
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

  it('removes a team from the session roster on kick, connected or not', async () => {
    const team = await teamService.join(sessionId, 'The Quizzards', {
      joinCode: 'ABCDEF',
    });

    await teamService.removeFromRoster(sessionId, team.id);

    expect(await teamService.listForSession(sessionId)).toEqual([]);
  });

  it('leaves the Team entity intact so a kicked team can still join another session', async () => {
    const session2Id = await createSecondSession('GHIJKL');
    const team = await teamService.join(sessionId, 'The Quizzards', {
      joinCode: 'ABCDEF',
    });

    await teamService.removeFromRoster(sessionId, team.id);
    const rejoined = await teamService.join(session2Id, 'The Quizzards', {
      teamToken: team.token,
      joinCode: 'GHIJKL',
    });

    expect(rejoined.id).toBe(team.id);
    expect(await teamService.listForSession(session2Id)).toEqual([
      { teamId: team.id, teamName: 'The Quizzards' },
    ]);
  });

  describe('listAll', () => {
    async function createBareTeam(name: string): Promise<Team> {
      const team = em.create(Team, {
        name,
        token: `${name}-token`,
        code: `${name}-code`,
      });
      await em.flush();
      return team;
    }

    it('returns every team with its sessionsJoined count, including teams with zero sessions', async () => {
      const session2Id = await createSecondSession('GHIJKL');
      const soloTeam = await teamService.join(sessionId, 'Solo Team', {
        joinCode: 'ABCDEF',
      });
      const multiTeam = await teamService.join(sessionId, 'Multi Team', {
        joinCode: 'ABCDEF',
      });
      await teamService.join(session2Id, 'ignored', {
        teamToken: multiTeam.token,
        joinCode: 'GHIJKL',
      });
      const bareTeam = await createBareTeam('Bare Team');

      const result = await teamService.listAll({
        page: 1,
        pageSize: 20,
        sortBy: 'joinedAt',
        sortOrder: 'asc',
      });

      expect(result.total).toBe(3);
      expect(result.items).toEqual([
        expect.objectContaining({ id: soloTeam.id, sessionsJoined: 1 }),
        expect.objectContaining({ id: multiTeam.id, sessionsJoined: 2 }),
        expect.objectContaining({ id: bareTeam.id, sessionsJoined: 0 }),
      ]);
    });

    it('paginates: page 2 returns the next slice, with a stable total across pages', async () => {
      await teamService.join(sessionId, 'Team A', { joinCode: 'ABCDEF' });
      await teamService.join(sessionId, 'Team B', { joinCode: 'ABCDEF' });
      await teamService.join(sessionId, 'Team C', { joinCode: 'ABCDEF' });

      const page1 = await teamService.listAll({
        page: 1,
        pageSize: 2,
        sortBy: 'joinedAt',
        sortOrder: 'asc',
      });
      const page2 = await teamService.listAll({
        page: 2,
        pageSize: 2,
        sortBy: 'joinedAt',
        sortOrder: 'asc',
      });

      expect(page1.items.map((item) => item.name)).toEqual([
        'Team A',
        'Team B',
      ]);
      expect(page2.items.map((item) => item.name)).toEqual(['Team C']);
      expect(page1.total).toBe(3);
      expect(page2.total).toBe(3);
    });

    it('sorts by sessionsJoined ascending, fewer sessions first', async () => {
      const session2Id = await createSecondSession('GHIJKL');
      const fewer = await teamService.join(sessionId, 'Fewer Sessions', {
        joinCode: 'ABCDEF',
      });
      const more = await teamService.join(sessionId, 'More Sessions', {
        joinCode: 'ABCDEF',
      });
      await teamService.join(session2Id, 'ignored', {
        teamToken: more.token,
        joinCode: 'GHIJKL',
      });

      const result = await teamService.listAll({
        page: 1,
        pageSize: 20,
        sortBy: 'sessionsJoined',
        sortOrder: 'asc',
      });

      expect(result.items.map((item) => item.id)).toEqual([fewer.id, more.id]);
    });

    it('sorts by joinedAt ascending, oldest team first', async () => {
      await teamService.join(sessionId, 'Older Team', { joinCode: 'ABCDEF' });
      await teamService.join(sessionId, 'Newer Team', { joinCode: 'ABCDEF' });

      const result = await teamService.listAll({
        page: 1,
        pageSize: 20,
        sortBy: 'joinedAt',
        sortOrder: 'asc',
      });

      expect(result.items.map((item) => item.name)).toEqual([
        'Older Team',
        'Newer Team',
      ]);
    });
  });
});
