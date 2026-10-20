import type { EntityManager } from '@mikro-orm/postgresql';
import type { GameStatus } from '@campus-pubquiz/types';
import { Answer } from '@/db/entities/answer.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { RoundRating } from '@/db/entities/round-rating.entity';
import { SessionFeedback } from '@/db/entities/session-feedback.entity';
import { SessionPlayerCount } from '@/db/entities/session-player-count.entity';
import { Team } from '@/db/entities/team.entity';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { TeamRepository } from '@/db/repositories/team.repository';
import { SessionPlayerCountRepository } from '@/db/repositories/session-player-count.repository';
import { PlayerCountService } from '@/player-count/player-count.service';
import { StandingsService } from '@/standings/standings.service';
import { TeamHistoryService } from '@/team/team-history.service';
import { useTestDatabase } from '@/test-db/test-database';

describe('TeamHistoryService (Postgres integration)', () => {
  const db = useTestDatabase();
  let em: EntityManager;
  let history: TeamHistoryService;
  let joinCounter = 0;

  beforeEach(() => {
    em = db.orm.em.fork();
    joinCounter = 0;
    history = new TeamHistoryService(
      em.getRepository<Team, TeamRepository>(Team),
      new StandingsService(
        em.getRepository<GameSessionTeam, GameSessionTeamRepository>(
          GameSessionTeam,
        ),
      ),
      new PlayerCountService(
        em.getRepository<SessionPlayerCount, SessionPlayerCountRepository>(
          SessionPlayerCount,
        ),
      ),
    );
  });

  /** A quiz with one round of questions worth `points` each. */
  async function createQuiz(points: number[]): Promise<{
    quiz: Quiz;
    round: Round;
    questions: Question[];
  }> {
    const quiz = em.create(Quiz, { title: 'Quiz' });
    const round = em.create(Round, { quiz, title: 'Round 1', orderIndex: 0 });
    const questions = points.map((point, index) =>
      em.create(Question, {
        round,
        orderIndex: index,
        type: 'free_text',
        prompt: `Q${index}`,
        answer: 'answer',
        points: point,
      }),
    );
    await em.flush();
    return { quiz, round, questions };
  }

  async function createSession(
    quiz: Quiz,
    status: GameStatus = 'ended',
    name: string | null = null,
  ): Promise<GameSession> {
    joinCounter += 1;
    const session = em.create(GameSession, {
      quiz,
      joinCode: `CODE${joinCounter}`,
      status,
      name,
    });
    await em.flush();
    return session;
  }

  async function createTeam(name: string): Promise<Team> {
    const team = em.create(Team, {
      name,
      token: `${name}-token`,
      code: `${name}-code`,
    });
    await em.flush();
    return team;
  }

  async function seat(session: GameSession, team: Team): Promise<void> {
    em.create(GameSessionTeam, { gameSession: session, team });
    await em.flush();
  }

  async function score(
    session: GameSession,
    question: Question,
    team: Team,
    points: number,
  ): Promise<void> {
    em.create(Answer, {
      gameSession: session,
      question,
      team,
      value: 'value',
      pointsAwarded: points,
      gradedAt: new Date(),
      verdict: points > 0 ? 'correct' : 'incorrect',
    });
    await em.flush();
  }

  async function report(
    session: GameSession,
    team: Team,
    playerCount: number,
  ): Promise<void> {
    em.create(SessionPlayerCount, { gameSession: session, team, playerCount });
    await em.flush();
  }

  /** Plays an ended session where each named team scores the given points on the quiz's first question. */
  async function playSession(
    scores: Record<string, number>,
    pointsOnQuestion = 10,
    options: { leavers?: string[]; name?: string } = {},
  ): Promise<{ session: GameSession; teams: Record<string, Team> }> {
    const { quiz, questions } = await createQuiz([pointsOnQuestion]);
    const session = await createSession(quiz, 'ended', options.name ?? null);
    const teams: Record<string, Team> = {};
    for (const [name, points] of Object.entries(scores)) {
      teams[name] =
        (await em.findOne(Team, { name })) ?? (await createTeam(name));
      if (!options.leavers?.includes(name)) await seat(session, teams[name]);
      await score(session, questions[0], teams[name], points);
    }
    return { session, teams };
  }

  it('returns null for an unknown team', async () => {
    await expect(history.detail(999)).resolves.toBeNull();
  });

  it('gives a team with no sessions an empty list and null averages', async () => {
    const team = await createTeam('Lonely');

    const detail = await history.detail(team.id);

    expect(detail).toEqual({
      id: team.id,
      name: 'Lonely',
      summary: {
        sessionsPlayed: 0,
        wins: 0,
        podiums: 0,
        bestPlacing: null,
        averagePlacing: null,
        averageSharePercent: null,
        averageTotalPoints: null,
        averagePlayerCount: null,
      },
      sessions: [],
    });
  });

  it('counts only ended sessions', async () => {
    const { quiz } = await createQuiz([10]);
    const live = await createSession(quiz, 'question_open');
    const team = await createTeam('Alpha');
    await seat(live, team);

    const detail = await history.detail(team.id);

    expect(detail!.sessions).toEqual([]);
    expect(detail!.summary.sessionsPlayed).toBe(0);
  });

  it('summarises wins, podiums, best and average placing from each session standings', async () => {
    const first = await playSession({ Alpha: 10, Beta: 5 });
    const second = await playSession({ Alpha: 5, Beta: 10, Gamma: 7 });
    await playSession({ Alpha: 1, Beta: 10, Gamma: 7, Delta: 5, Eps: 4 });
    const alpha = first.teams.Alpha;
    expect(second.teams.Alpha.id).toBe(alpha.id);

    const detail = await history.detail(alpha.id);

    // placings: 1st, 3rd, 5th
    expect(detail!.summary).toMatchObject({
      sessionsPlayed: 3,
      wins: 1,
      podiums: 2,
      bestPlacing: 1,
      averagePlacing: 3,
    });
    expect(detail!.sessions.map((s) => [s.placing, s.teamCount])).toEqual([
      [5, 5],
      [3, 3],
      [1, 2],
    ]);
  });

  it('rounds the average placing to one decimal', async () => {
    await playSession({ Alpha: 10, Beta: 5 });
    await playSession({ Alpha: 5, Beta: 10 });
    await playSession({ Alpha: 4, Beta: 10, Gamma: 7 });
    const alpha = (await em.findOne(Team, { name: 'Alpha' }))!;

    const detail = await history.detail(alpha.id);

    // placings 1, 2, 3 -> 2.0 ; add a 2-of-2 and a 3-of-3 -> still check decimals
    expect(detail!.summary.averagePlacing).toBe(2);
    await playSession({ Alpha: 1, Beta: 10, Gamma: 7 });
    const again = await history.detail(alpha.id);
    expect(again!.summary.averagePlacing).toBe(2.3);
  });

  it('counts a tie at its shared placing and lists the tie span', async () => {
    const { teams } = await playSession({ Alpha: 5, Beta: 10, Gamma: 5 });

    const detail = await history.detail(teams.Alpha.id);

    expect(detail!.sessions[0]).toMatchObject({ placing: 2, placingTo: 3 });
    expect(detail!.summary).toMatchObject({
      bestPlacing: 2,
      averagePlacing: 2,
      podiums: 1,
      wins: 0,
    });
  });

  it('counts a tie for first as a win for every tied team', async () => {
    const { teams } = await playSession({ Zed: 10, Amy: 10 });

    const amy = await history.detail(teams.Amy.id);
    const zed = await history.detail(teams.Zed.id);

    expect(amy!.summary.wins).toBe(1);
    expect(zed!.summary.wins).toBe(1);
    expect(zed!.sessions[0]).toMatchObject({ placing: 1, placingTo: 2 });
    expect(zed!.summary.podiums).toBe(1);
  });

  it('lists a session the team left as left but leaves it out of every placing figure', async () => {
    await playSession({ Alpha: 10, Beta: 5 });
    const { session } = await playSession({ Alpha: 10, Beta: 5 }, 10, {
      leavers: ['Alpha'],
      name: 'Left early',
    });
    const alpha = (await em.findOne(Team, { name: 'Alpha' }))!;

    const detail = await history.detail(alpha.id);

    expect(detail!.summary).toMatchObject({
      sessionsPlayed: 2,
      wins: 1,
      podiums: 1,
      bestPlacing: 1,
      averagePlacing: 1,
    });
    expect(detail!.sessions[0]).toMatchObject({
      gameSessionId: session.id,
      name: 'Left early',
      hasLeft: true,
      placing: null,
      placingTo: null,
      totalPoints: 10,
      teamCount: 2,
    });
  });

  it('gives a team that only left sessions a null average placing', async () => {
    const { teams } = await playSession({ Alpha: 10, Beta: 5 }, 10, {
      leavers: ['Alpha'],
    });

    const detail = await history.detail(teams.Alpha.id);

    expect(detail!.summary).toMatchObject({
      sessionsPlayed: 1,
      wins: 0,
      podiums: 0,
      bestPlacing: null,
      averagePlacing: null,
    });
  });

  it('averages the share of max points per session, not pooled', async () => {
    // Session 1: 10 of 10 (100%). Session 2: 10 of 40 (25%). Pooled would be 40%.
    await playSession({ Alpha: 10 }, 10);
    const { teams } = await playSession({ Alpha: 10 }, 40);

    const detail = await history.detail(teams.Alpha.id);

    expect(detail!.summary.averageSharePercent).toBeCloseTo(62.5);
    expect(detail!.summary.averageTotalPoints).toBe(10);
    expect(detail!.sessions.map((s) => s.maxPoints)).toEqual([40, 10]);
  });

  it('leaves a session with no points to win out of the share average', async () => {
    await playSession({ Alpha: 0 }, 0);
    const { teams } = await playSession({ Alpha: 10 }, 10);

    const detail = await history.detail(teams.Alpha.id);

    expect(detail!.summary.averageSharePercent).toBe(100);
    expect(detail!.summary.sessionsPlayed).toBe(2);
  });

  it('has no share average when every session has no points to win', async () => {
    const { teams } = await playSession({ Alpha: 0 }, 0);

    const detail = await history.detail(teams.Alpha.id);

    expect(detail!.summary.averageSharePercent).toBeNull();
  });

  it('counts correct answers per session', async () => {
    const { quiz, questions } = await createQuiz([5, 5, 5]);
    const session = await createSession(quiz);
    const team = await createTeam('Alpha');
    await seat(session, team);
    await score(session, questions[0], team, 5);
    await score(session, questions[1], team, 5);
    await score(session, questions[2], team, 0);

    const detail = await history.detail(team.id);

    expect(detail!.sessions[0].correctCount).toBe(2);
  });

  it('averages the player count over sessions that have one', async () => {
    const first = await playSession({ Alpha: 10 });
    const second = await playSession({ Alpha: 10 });
    await playSession({ Alpha: 10 });
    await report(first.session, first.teams.Alpha, 4);
    await report(second.session, second.teams.Alpha, 5);

    const detail = await history.detail(first.teams.Alpha.id);

    expect(detail!.summary.averagePlayerCount).toBe(4.5);
    expect(detail!.sessions.map((s) => s.playerCount)).toEqual([null, 5, 4]);
  });

  it('keeps the player count of a team that left', async () => {
    const { session, teams } = await playSession({ Alpha: 10 }, 10, {
      leavers: ['Alpha'],
    });
    await report(session, teams.Alpha, 3);

    const detail = await history.detail(teams.Alpha.id);

    expect(detail!.sessions[0].playerCount).toBe(3);
  });

  it('lists sessions newest first', async () => {
    const older = await playSession({ Alpha: 1 });
    const newer = await playSession({ Alpha: 1 });
    older.session.createdAt = new Date('2020-01-01T00:00:00Z');
    newer.session.createdAt = new Date('2021-01-01T00:00:00Z');
    await em.flush();

    const detail = await history.detail(older.teams.Alpha.id);

    expect(detail!.sessions.map((s) => s.gameSessionId)).toEqual([
      newer.session.id,
      older.session.id,
    ]);
  });

  it('never carries feedback or the team code', async () => {
    const { session, teams } = await playSession({ Alpha: 10 });
    const round = (await em.findAll(Round))[0];
    em.create(RoundRating, {
      gameSession: session,
      team: teams.Alpha,
      round,
      stars: 5,
    });
    em.create(SessionFeedback, {
      gameSession: session,
      team: teams.Alpha,
      comment: 'secret comment',
      topics: ['secret topic'],
    });
    await em.flush();

    const detail = await history.detail(teams.Alpha.id);

    const json = JSON.stringify(detail);
    expect(json).not.toContain('secret');
    expect(json).not.toContain('Alpha-code');
    expect(json).not.toContain('stars');
  });

  describe('resultsForTeams', () => {
    it('returns each requested team its own rows in one pass', async () => {
      const { teams } = await playSession({ Alpha: 10, Beta: 5 });

      const results = await history.resultsForTeams([
        teams.Alpha.id,
        teams.Beta.id,
      ]);

      expect(results.get(teams.Alpha.id)![0].placing).toBe(1);
      expect(results.get(teams.Beta.id)![0].placing).toBe(2);
    });

    it('gives a team with no sessions an empty list', async () => {
      const team = await createTeam('Lonely');

      const results = await history.resultsForTeams([team.id]);

      expect(results.get(team.id)).toEqual([]);
    });
  });
});
