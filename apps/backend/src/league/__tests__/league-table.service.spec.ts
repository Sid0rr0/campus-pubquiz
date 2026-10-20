import type { EntityManager } from '@mikro-orm/postgresql';
import type { GameStatus } from '@campus-pubquiz/types';
import { Answer } from '@/db/entities/answer.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { League } from '@/db/entities/league.entity';
import { LeagueSession } from '@/db/entities/league-session.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { Team } from '@/db/entities/team.entity';
import type { LeagueRepository } from '@/db/repositories/league.repository';
import type { LeagueSessionRepository } from '@/db/repositories/league-session.repository';
import { LeagueTableService } from '@/league/league-table.service';
import { buildStandingsService } from '@/standings/__tests__/standings-test-utils';
import { useTestDatabase } from '@/test-db/test-database';

describe('LeagueTableService (Postgres integration)', () => {
  const db = useTestDatabase();
  let em: EntityManager;
  let service: LeagueTableService;
  let quiz: Quiz;
  let question: Question;
  let counter = 0;

  beforeEach(async () => {
    em = db.orm.em.fork();
    counter = 0;
    service = new LeagueTableService(
      em.getRepository<League, LeagueRepository>(League),
      em.getRepository<LeagueSession, LeagueSessionRepository>(LeagueSession),
      buildStandingsService(em),
    );
    quiz = em.create(Quiz, { title: 'Movie Night' });
    const round = em.create(Round, { quiz, orderIndex: 0, title: 'Round 1' });
    question = em.create(Question, {
      round,
      orderIndex: 0,
      type: 'free_text',
      prompt: 'Q',
      answer: 'A',
      points: 10,
    });
    await em.flush();
  });

  async function newLeague(name = 'Autumn', endsOn = '2999-12-31') {
    const league = em.create(League, { name, startsOn: '2019-09-01', endsOn });
    await em.flush();
    return league;
  }

  async function newSession(status: GameStatus = 'ended') {
    counter += 1;
    const session = em.create(GameSession, {
      quiz,
      joinCode: `CODE${counter}`,
      status,
    });
    await em.flush();
    return session;
  }

  async function newTeam(name: string) {
    counter += 1;
    const team = em.create(Team, {
      name,
      token: `token-${counter}`,
      code: `code-${counter}`,
    });
    await em.flush();
    return team;
  }

  /** The team plays the session: on the roster, with one answer worth `points`. */
  async function play(
    session: GameSession,
    team: Team,
    points: number,
    { onRoster = true, answers = true } = {},
  ) {
    if (onRoster) em.create(GameSessionTeam, { gameSession: session, team });
    if (answers) {
      em.create(Answer, {
        gameSession: session,
        question,
        team,
        value: 'guess',
        pointsAwarded: points,
      });
    }
    await em.flush();
  }

  async function join(league: League, session: GameSession) {
    em.create(LeagueSession, { league, gameSession: session });
    await em.flush();
  }

  it('is null for an unknown league', async () => {
    expect(await service.table(999)).toBeNull();
  });

  it('is an empty table for a league with no sessions', async () => {
    const league = await newLeague();

    expect(await service.table(league.id)).toMatchObject({
      id: league.id,
      name: 'Autumn',
      current: true,
      rows: [],
    });
  });

  it('ranks teams by league points across the ended member sessions', async () => {
    const league = await newLeague();
    const [alpha, beta] = [await newTeam('Alpha'), await newTeam('Beta')];
    const night1 = await newSession();
    const night2 = await newSession();
    for (const night of [night1, night2]) await join(league, night);
    await play(night1, alpha, 8);
    await play(night1, beta, 5);
    await play(night2, alpha, 3);
    await play(night2, beta, 9);

    const table = await service.table(league.id);

    expect(table?.rows).toEqual([
      {
        teamId: alpha.id,
        teamName: 'Alpha',
        leaguePoints: 11,
        nightsPlayed: 2,
        nightsWon: 1,
        averagePlacing: 1.5,
        position: 1,
      },
      {
        teamId: beta.id,
        teamName: 'Beta',
        leaguePoints: 11,
        nightsPlayed: 2,
        nightsWon: 1,
        averagePlacing: 1.5,
        position: 1,
      },
    ]);
  });

  it('counts only ended member sessions', async () => {
    const league = await newLeague();
    const team = await newTeam('Alpha');
    const live = await newSession('question_open');
    const notMember = await newSession();
    const ended = await newSession();
    await join(league, live);
    await join(league, ended);
    for (const session of [live, notMember, ended])
      await play(session, team, 4);

    const table = await service.table(league.id);

    expect(table?.rows).toHaveLength(1);
    expect(table?.rows[0]).toMatchObject({ nightsPlayed: 1, leaguePoints: 6 });
  });

  it('counts a session in two leagues in both', async () => {
    const first = await newLeague('First');
    const second = await newLeague('Second');
    const team = await newTeam('Alpha');
    const night = await newSession();
    await join(first, night);
    await join(second, night);
    await play(night, team, 4);

    for (const league of [first, second]) {
      expect((await service.table(league.id))?.rows[0]).toMatchObject({
        teamName: 'Alpha',
        leaguePoints: 6,
      });
    }
  });

  it('gives a team that left the participation point only, and a silent team nothing', async () => {
    const league = await newLeague();
    const stayer = await newTeam('Stayer');
    const leaver = await newTeam('Leaver');
    const silent = await newTeam('Silent');
    const night = await newSession();
    await join(league, night);
    await play(night, stayer, 5);
    await play(night, leaver, 9, { onRoster: false });
    await play(night, silent, 0, { answers: false });

    const table = await service.table(league.id);

    expect(table?.rows.map((r) => [r.teamName, r.leaguePoints])).toEqual([
      ['Stayer', 6],
      ['Leaver', 1],
    ]);
    expect(table?.rows[1]).toMatchObject({
      nightsPlayed: 1,
      averagePlacing: null,
    });
  });

  it('exposes only table fields: no codes, tokens or feedback', async () => {
    const league = await newLeague();
    const team = await newTeam('Alpha');
    const night = await newSession();
    await join(league, night);
    await play(night, team, 4);

    const table = await service.table(league.id);

    expect(Object.keys(table!).sort()).toEqual([
      'current',
      'endsOn',
      'id',
      'name',
      'rows',
      'startsOn',
    ]);
    expect(Object.keys(table!.rows[0]).sort()).toEqual([
      'averagePlacing',
      'leaguePoints',
      'nightsPlayed',
      'nightsWon',
      'position',
      'teamId',
      'teamName',
    ]);
  });

  describe('top of the session league', () => {
    it('is null when the session is in no league', async () => {
      await newLeague();
      const lobby = await newSession('lobby');

      expect(await service.topFor(lobby.id)).toBeNull();
    });

    it('is the league name with its top five rows, ended nights only', async () => {
      const league = await newLeague('Autumn');
      const night = await newSession();
      await join(league, night);
      const lobby = await newSession('lobby');
      await join(league, lobby);
      for (let rank = 1; rank <= 6; rank += 1) {
        await play(night, await newTeam(`Team ${rank}`), 100 - rank);
      }

      const top = await service.topFor(lobby.id);

      expect(top?.name).toBe('Autumn');
      expect(top?.rows.map((row) => row.teamName)).toEqual([
        'Team 1',
        'Team 2',
        'Team 3',
        'Team 4',
        'Team 5',
      ]);
      expect(Object.keys(top!).sort()).toEqual(['name', 'rows']);
    });

    it('is the most recently created league when the session is in several', async () => {
      const older = await newLeague('Older');
      const newer = await newLeague('Newer');
      const lobby = await newSession('lobby');
      await join(newer, lobby);
      await join(older, lobby);

      expect((await service.topFor(lobby.id))?.name).toBe('Newer');
    });

    it('is an empty list for a league nobody has played in yet', async () => {
      const league = await newLeague('Fresh');
      const lobby = await newSession('lobby');
      await join(league, lobby);

      expect(await service.topFor(lobby.id)).toEqual({
        name: 'Fresh',
        rows: [],
      });
    });
  });

  describe("a team's league positions", () => {
    it('matches the public table, with the team count and points', async () => {
      const league = await newLeague('Autumn');
      const [alpha, beta, gamma] = [
        await newTeam('Alpha'),
        await newTeam('Beta'),
        await newTeam('Gamma'),
      ];
      const night = await newSession();
      await join(league, night);
      await play(night, alpha, 9);
      await play(night, beta, 5);
      await play(night, gamma, 1);

      const table = await service.table(league.id);
      const positions = await service.positionsOf(gamma.id);

      expect(positions).toEqual([
        {
          leagueId: league.id,
          leagueName: 'Autumn',
          position: table!.rows.find((r) => r.teamId === gamma.id)!.position,
          shared: false,
          teamCount: 3,
          leaguePoints: 4,
        },
      ]);
      expect(positions[0].position).toBe(3);
    });

    it('marks a shared position', async () => {
      const league = await newLeague();
      const [alpha, beta, gamma] = [
        await newTeam('Alpha'),
        await newTeam('Beta'),
        await newTeam('Gamma'),
      ];
      const night = await newSession();
      await join(league, night);
      await play(night, alpha, 9);
      await play(night, beta, 5);
      await play(night, gamma, 5);

      expect(await service.positionsOf(gamma.id)).toMatchObject([
        { position: 2, shared: true, teamCount: 3 },
      ]);
    });

    it('omits leagues that are not current and leagues where the team has no points', async () => {
      const past = await newLeague('Past', '2020-01-31');
      const current = await newLeague('Current');
      const other = await newLeague('Other');
      const team = await newTeam('Alpha');
      const rival = await newTeam('Rival');
      const night = await newSession();
      const otherNight = await newSession();
      await join(past, night);
      await join(current, night);
      await join(other, otherNight);
      await play(night, team, 4);
      await play(otherNight, rival, 4);

      const positions = await service.positionsOf(team.id);

      expect(positions.map((p) => p.leagueName)).toEqual(['Current']);
    });

    it('lists several current leagues, newest first, and none for an unknown team', async () => {
      const first = await newLeague('First');
      const second = await newLeague('Second');
      const team = await newTeam('Alpha');
      const night = await newSession();
      await join(first, night);
      await join(second, night);
      await play(night, team, 4);

      expect(
        (await service.positionsOf(team.id)).map((p) => p.leagueName),
      ).toEqual(['Second', 'First']);
      expect(await service.positionsOf(9999)).toEqual([]);
    });
  });

  describe('public leagues', () => {
    it('follows the admin order within current and ended leagues', async () => {
      const older = await newLeague('Older', '2999-06-30');
      await newLeague('Newer', '2999-12-31');
      const ended = await newLeague('Ended', '2020-01-31');
      await em.nativeUpdate(League, { id: older.id }, { sortOrder: 5 });
      await em.nativeUpdate(League, { id: ended.id }, { sortOrder: 9 });
      em.clear();

      const { items } = await service.publicLeagues(
        new Date('2026-11-15T12:00:00Z'),
      );

      expect(items.map((l) => l.name)).toEqual(['Older', 'Newer', 'Ended']);
    });

    it('lists current leagues first, then the rest, without sessions', async () => {
      await newLeague('Old', '2020-01-31');
      await newLeague('Now', '2999-12-31');
      const night = await newSession();
      await join(await newLeague('Newer', '2999-06-30'), night);

      const { items } = await service.publicLeagues(
        new Date('2026-11-15T12:00:00Z'),
      );

      expect(items.map((l) => [l.name, l.current])).toEqual([
        ['Newer', true],
        ['Now', true],
        ['Old', false],
      ]);
      expect(Object.keys(items[0]).sort()).toEqual([
        'current',
        'endsOn',
        'id',
        'name',
        'startsOn',
      ]);
    });
  });
});
