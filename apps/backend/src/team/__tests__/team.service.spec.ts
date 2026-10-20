import type { EntityManager } from '@mikro-orm/postgresql';
import { Answer } from '@/db/entities/answer.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { Team } from '@/db/entities/team.entity';
import { SessionPlayerCount } from '@/db/entities/session-player-count.entity';
import { SessionPlayerCountRepository } from '@/db/repositories/session-player-count.repository';
import { EndedSessionsRead } from '@/ended-sessions-read/ended-sessions-read';
import { PlayerCountService } from '@/player-count/player-count.service';
import { buildStandingsService } from '@/standings/__tests__/standings-test-utils';
import { TeamHistoryService } from '@/team/team-history.service';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { TeamRepository } from '@/db/repositories/team.repository';
import {
  InvalidJoinCodeError,
  TeamCodeRequiredError,
  TeamService,
} from '@/team/team.service';
import { useTestDatabase } from '@/test-db/test-database';

describe('TeamService (Postgres integration)', () => {
  const db = useTestDatabase();
  let em: EntityManager;
  let teamService: TeamService;
  let sessionId: number;

  beforeEach(async () => {
    em = db.orm.em.fork();
    const gameSessionTeams = em.getRepository<
      GameSessionTeam,
      GameSessionTeamRepository
    >(GameSessionTeam);
    const teams = em.getRepository<Team, TeamRepository>(Team);
    teamService = new TeamService(
      teams,
      em.getRepository<GameSession, GameSessionRepository>(GameSession),
      gameSessionTeams,
      buildHistory(),
      new EndedSessionsRead(gameSessionTeams),
    );
    const quiz = em.create(Quiz, { title: 'Team Test Quiz' });
    const session = em.create(GameSession, { quiz, joinCode: 'ABCDEF' });
    await em.flush();
    sessionId = session.id;
  });

  function buildHistory(): TeamHistoryService {
    return new TeamHistoryService(
      em.getRepository<Team, TeamRepository>(Team),
      buildStandingsService(em),
      new PlayerCountService(
        em.getRepository<SessionPlayerCount, SessionPlayerCountRepository>(
          SessionPlayerCount,
        ),
      ),
    );
  }

  /** A question in the quiz of the given session. */
  async function seedQuestion(forSessionId: number): Promise<Question> {
    const session = await em.findOneOrFail(GameSession, forSessionId);
    const round = em.create(Round, {
      quiz: session.quiz,
      title: 'Round 1',
      orderIndex: 0,
    });
    const question = em.create(Question, {
      round,
      orderIndex: 0,
      type: 'free_text',
      prompt: 'Q',
      answer: 'a',
      points: 10,
    });
    await em.flush();
    return question;
  }

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

  describe('getTeamCode', () => {
    it('returns the team id, name, and persistent join code', async () => {
      const team = await teamService.join(sessionId, 'The Quizzards', {
        joinCode: 'ABCDEF',
      });

      await expect(teamService.getTeamCode(team.id)).resolves.toEqual({
        teamId: team.id,
        teamName: 'The Quizzards',
        code: team.code,
      });
    });

    it('returns null for an unknown team id', async () => {
      await expect(teamService.getTeamCode(-1)).resolves.toBeNull();
    });
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

    async function endSession(id: number): Promise<void> {
      await em.nativeUpdate(GameSession, { id }, { status: 'ended' });
    }

    it('returns every team with its ended sessions played, including teams with none', async () => {
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
      await endSession(sessionId);
      await endSession(session2Id);

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

    it('does not count a lobby or running session until it ends', async () => {
      const team = await teamService.join(sessionId, 'Lobby Team', {
        joinCode: 'ABCDEF',
      });
      const items = async () =>
        (
          await teamService.listAll({
            page: 1,
            pageSize: 20,
            sortBy: 'joinedAt',
            sortOrder: 'asc',
          })
        ).items;

      expect(await items()).toEqual([
        expect.objectContaining({ id: team.id, sessionsJoined: 0 }),
      ]);

      await endSession(sessionId);

      expect(await items()).toEqual([
        expect.objectContaining({ id: team.id, sessionsJoined: 1 }),
      ]);
    });

    it('shows the same sessions played as the team history summary, for a kicked team and a lobby team', async () => {
      const session2Id = await createSecondSession('GHIJKL');
      const kicked = await teamService.join(sessionId, 'Kicked Team', {
        joinCode: 'ABCDEF',
      });
      const lobby = await teamService.join(session2Id, 'Lobby Team', {
        joinCode: 'GHIJKL',
      });
      const question = await seedQuestion(sessionId);
      em.create(Answer, {
        gameSession: em.getReference(GameSession, sessionId),
        question,
        team: em.getReference(Team, kicked.id),
        value: 'v',
        pointsAwarded: 5,
        gradedAt: new Date(),
        verdict: 'correct',
      });
      await em.flush();
      await teamService.removeFromRoster(sessionId, kicked.id);
      await endSession(sessionId);

      const { items } = await teamService.listAll({
        page: 1,
        pageSize: 20,
        sortBy: 'joinedAt',
        sortOrder: 'asc',
      });
      const history = buildHistory();

      for (const team of [kicked, lobby]) {
        const detail = await history.detail(team.id);
        expect(items.find((item) => item.id === team.id)?.sessionsJoined).toBe(
          detail!.summary.sessionsPlayed,
        );
      }
      expect(items.find((item) => item.id === kicked.id)?.sessionsJoined).toBe(
        1,
      );
      expect(items.find((item) => item.id === lobby.id)?.sessionsJoined).toBe(
        0,
      );
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

    it('sorts by sessions played ascending, fewer ended sessions first', async () => {
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
      await endSession(sessionId);
      await endSession(session2Id);

      const result = await teamService.listAll({
        page: 1,
        pageSize: 20,
        sortBy: 'sessionsJoined',
        sortOrder: 'asc',
      });

      expect(result.items.map((item) => item.id)).toEqual([fewer.id, more.id]);
    });

    describe('averagePlacing', () => {
      /** Plays an ended session where each named team is seated and scores the given points. */
      async function playEndedSession(
        scores: Record<string, number>,
        options: { leavers?: string[] } = {},
      ): Promise<void> {
        const quiz = em.create(Quiz, { title: 'Played Quiz' });
        const round = em.create(Round, {
          quiz,
          title: 'Round 1',
          orderIndex: 0,
        });
        const question = em.create(Question, {
          round,
          orderIndex: 0,
          type: 'free_text',
          prompt: 'Q',
          answer: 'a',
          points: 10,
        });
        playedSessions += 1;
        const session = em.create(GameSession, {
          quiz,
          joinCode: `PLAY${playedSessions}`,
          status: 'ended',
        });
        await em.flush();
        for (const [name, points] of Object.entries(scores)) {
          const team =
            (await em.findOne(Team, { name })) ??
            em.create(Team, {
              name,
              token: `${name}-token`,
              code: `${name}-code`,
            });
          if (!options.leavers?.includes(name)) {
            em.create(GameSessionTeam, { gameSession: session, team });
          }
          em.create(Answer, {
            gameSession: session,
            question,
            team,
            value: 'v',
            pointsAwarded: points,
            gradedAt: new Date(),
            verdict: points > 0 ? 'correct' : 'incorrect',
          });
          await em.flush();
        }
      }
      let playedSessions = 0;

      async function listByAveragePlacing(
        sortOrder: 'asc' | 'desc',
      ): Promise<Array<{ name: string; averagePlacing: number | null }>> {
        const result = await teamService.listAll({
          page: 1,
          pageSize: 20,
          sortBy: 'averagePlacing',
          sortOrder,
        });
        return result.items.map(({ name, averagePlacing }) => ({
          name,
          averagePlacing,
        }));
      }

      it('averages placings to one decimal, counts ties at the shared placing and leaves out left sessions', async () => {
        await playEndedSession({ Ace: 30, Bee: 20, Cat: 10 });
        await playEndedSession({ Ace: 20, Bee: 20, Cat: 10 });
        await playEndedSession({ Bee: 5, Ace: 1 }, { leavers: ['Ace'] });

        const items = await listByAveragePlacing('asc');

        // Ace: 1st, tied 1st (left session ignored) = 1.0; Bee: 2nd, tied 1st, 1st = 1.3; Cat: 3rd, 3rd = 3.0
        expect(items).toEqual([
          { name: 'Ace', averagePlacing: 1 },
          { name: 'Bee', averagePlacing: 1.3 },
          { name: 'Cat', averagePlacing: 3 },
        ]);
      });

      it('puts teams with no placing last when sorting ascending and descending', async () => {
        await playEndedSession({ Ace: 20, Bee: 10 });
        await createBareTeam('Bare');

        const asc = await listByAveragePlacing('asc');
        const desc = await listByAveragePlacing('desc');

        expect(asc.map((item) => item.name)).toEqual(['Ace', 'Bee', 'Bare']);
        expect(desc.map((item) => item.name)).toEqual(['Bee', 'Ace', 'Bare']);
        expect(asc[2].averagePlacing).toBeNull();
      });

      it('paginates over the placing order', async () => {
        await playEndedSession({ Ace: 30, Bee: 20, Cat: 10 });

        const page2 = await teamService.listAll({
          page: 2,
          pageSize: 2,
          sortBy: 'averagePlacing',
          sortOrder: 'asc',
        });

        expect(page2.items.map((item) => item.name)).toEqual(['Cat']);
        expect(page2.total).toBe(3);
      });

      it('reports averagePlacing on the default sort too', async () => {
        await playEndedSession({ Ace: 20, Bee: 10 });

        const result = await teamService.listAll({
          page: 1,
          pageSize: 20,
          sortBy: 'joinedAt',
          sortOrder: 'asc',
        });

        expect(result.items.map((item) => item.averagePlacing)).toEqual([1, 2]);
      });
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
