import { NotFoundException } from '@nestjs/common';
import type { EntityManager } from '@mikro-orm/postgresql';
import {
  DEFAULT_SESSION_SETTINGS,
  type GameStatus,
} from '@campus-pubquiz/types';
import { Answer } from '@/db/entities/answer.entity';
import { BonusAward } from '@/db/entities/bonus-award.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { League } from '@/db/entities/league.entity';
import { LeagueSession } from '@/db/entities/league-session.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { RoundRating } from '@/db/entities/round-rating.entity';
import { SessionFeedback } from '@/db/entities/session-feedback.entity';
import { SessionPlayerCount } from '@/db/entities/session-player-count.entity';
import { Team } from '@/db/entities/team.entity';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';
import { SessionPlayerCountRepository } from '@/db/repositories/session-player-count.repository';
import { buildEndedSessionsRead } from '@/ended-sessions-read/__tests__/ended-sessions-read-test-utils';
import { PlayerCountService } from '@/player-count/player-count.service';
import { buildStandingsService } from '@/standings/__tests__/standings-test-utils';
import { StatsService } from '@/stats/stats.service';
import { useTestDatabase } from '@/test-db/test-database';

describe('StatsService (Postgres integration)', () => {
  const db = useTestDatabase();
  let em: EntityManager;
  let statsService: StatsService;

  beforeEach(() => {
    em = db.orm.em.fork();
    statsService = new StatsService(
      em.getRepository<GameSession, GameSessionRepository>(GameSession),
      buildStandingsService(em),
      new PlayerCountService(
        em.getRepository<SessionPlayerCount, SessionPlayerCountRepository>(
          SessionPlayerCount,
        ),
      ),
      buildEndedSessionsRead(em),
    );
  });

  /** Builds a quiz with one round per array entry, one question per point value within it. */
  async function createQuiz(
    title: string,
    roundPoints: number[][],
  ): Promise<{ quiz: Quiz; questions: Question[][] }> {
    const quiz = em.create(Quiz, { title });
    const questions = roundPoints.map((points, roundIndex) => {
      const round = em.create(Round, {
        quiz,
        title: `Round ${roundIndex + 1}`,
        orderIndex: roundIndex,
      });
      return points.map((point, questionIndex) =>
        em.create(Question, {
          round,
          orderIndex: questionIndex,
          type: 'free_text',
          prompt: `Q${questionIndex}`,
          answer: 'answer',
          points: point,
        }),
      );
    });
    await em.flush();
    return { quiz, questions };
  }

  async function createSession(
    quiz: Quiz,
    joinCode: string,
    status: GameStatus,
    name?: string | null,
  ): Promise<GameSession> {
    const session = em.create(GameSession, {
      quiz,
      joinCode,
      status,
      name: name ?? null,
    });
    await em.flush();
    return session;
  }

  async function joinTeam(session: GameSession, name: string): Promise<Team> {
    const team = em.create(Team, {
      name,
      token: `${name}-token`,
      code: `${name}-code`,
    });
    em.create(GameSessionTeam, { gameSession: session, team });
    await em.flush();
    return team;
  }

  async function grade(
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

  async function awardBonus(
    session: GameSession,
    team: Team,
    points: number,
  ): Promise<void> {
    em.create(BonusAward, {
      gameSession: session,
      team,
      category: 'shot',
      points,
    });
    await em.flush();
  }

  const defaultQuery = {
    page: 1,
    pageSize: 20,
    sortBy: 'playedAt' as const,
    sortOrder: 'desc' as const,
  };

  it('sums the points of every question across every round for maxPoints', async () => {
    const { quiz } = await createQuiz('Quiz B', [[1, 2], [3]]);
    await createSession(quiz, 'MAXPTS', 'ended');

    const {
      items: [result],
    } = await statsService.listPlayedSessions(defaultQuery);

    expect(result.maxPoints).toBe(6);
  });

  it('reports a zero teamCount and null winner fields when no teams joined', async () => {
    const { quiz } = await createQuiz('Quiz C', [[1]]);
    await createSession(quiz, 'EMPTY1', 'ended');

    const {
      items: [result],
    } = await statsService.listPlayedSessions(defaultQuery);

    expect(result.teamCount).toBe(0);
    expect(result.winnerTeamName).toBeNull();
    expect(result.winnerPoints).toBeNull();
  });

  it("picks the leaderboard winner by total incl. bonus and shows that team's total", async () => {
    const { quiz, questions } = await createQuiz('Quiz D', [[5, 5]]);
    const session = await createSession(quiz, 'BONUSWIN', 'ended');
    const [q1, q2] = questions[0];
    const teamA = await joinTeam(session, 'Team A');
    const teamB = await joinTeam(session, 'Team B');

    // Team A leads on raw answer points...
    await grade(session, q1, teamA, 8);
    await grade(session, q2, teamB, 3);
    // ...but Team B's bonus pushes them into the overall lead.
    await awardBonus(session, teamB, 10);

    const {
      items: [result],
    } = await statsService.listPlayedSessions(defaultQuery);

    expect(result.teamCount).toBe(2);
    expect(result.winnerTeamName).toBe('Team B');
    expect(result.winnerPoints).toBe(13);
  });

  describe('agreement with stats detail', () => {
    async function listAndDetail(session: GameSession) {
      const { items } = await statsService.listPlayedSessions(defaultQuery);
      const listed = items.find((item) => item.gameSessionId === session.id)!;
      const detail = await statsService.getSessionDetail(session.id);
      return { listed, detail };
    }

    it('counts a kicked team and never names it the winner', async () => {
      const { quiz, questions } = await createQuiz('Quiz K', [[10]]);
      const session = await createSession(quiz, 'AGREEKICK', 'ended');
      const cheater = await joinTeam(session, 'Cheater');
      const honest = await joinTeam(session, 'Honest');
      await grade(session, questions[0][0], cheater, 10);
      await grade(session, questions[0][0], honest, 3);
      await em.nativeDelete(GameSessionTeam, {
        gameSession: session,
        team: cheater,
      });

      const { listed, detail } = await listAndDetail(session);

      expect(listed.teamCount).toBe(2);
      expect(listed.teamCount).toBe(detail.teamCount);
      expect(listed.winnerTeamName).toBe('Honest');
      expect(listed.winnerPoints).toBe(3);
      expect(detail.standings.find((s) => s.isWinner)?.teamName).toBe('Honest');
    });

    it('names the showdown winner of a tie, with the showdown bonus in the points', async () => {
      const { quiz, questions } = await createQuiz('Quiz S', [[5]]);
      const session = await createSession(quiz, 'AGREESHOW', 'ended');
      const amy = await joinTeam(session, 'Amy');
      const zed = await joinTeam(session, 'Zed');
      await grade(session, questions[0][0], amy, 5);
      await grade(session, questions[0][0], zed, 5);
      await awardBonus(session, zed, 2);

      const { listed, detail } = await listAndDetail(session);

      expect(listed.winnerTeamName).toBe('Zed');
      expect(listed.winnerPoints).toBe(7);
      expect(detail.standings.find((s) => s.isWinner)?.teamName).toBe('Zed');
    });

    it('falls back to the same name-order winner as detail when a tie for first was never broken', async () => {
      const { quiz, questions } = await createQuiz('Quiz U', [[5]]);
      const session = await createSession(quiz, 'AGREETIE', 'ended');
      const zed = await joinTeam(session, 'Zed');
      const amy = await joinTeam(session, 'Amy');
      await grade(session, questions[0][0], zed, 5);
      await grade(session, questions[0][0], amy, 5);

      const { listed, detail } = await listAndDetail(session);

      expect(listed.winnerTeamName).toBe('Amy');
      expect(detail.standings.find((s) => s.isWinner)?.teamName).toBe('Amy');
    });
  });

  describe('sorting by winner points', () => {
    async function endedSessionWithWinner(
      joinCode: string,
      winnerPoints: number | null,
    ): Promise<GameSession> {
      const { quiz, questions } = await createQuiz(`Quiz ${joinCode}`, [[100]]);
      const session = await createSession(quiz, joinCode, 'ended');
      if (winnerPoints !== null) {
        const team = await joinTeam(session, `Team ${joinCode}`);
        await grade(session, questions[0][0], team, winnerPoints);
      }
      return session;
    }

    it('orders across pages in both directions, treating a session with no teams as lowest', async () => {
      const low = await endedSessionWithWinner('LOW', 10);
      const mid = await endedSessionWithWinner('MID', 20);
      const high = await endedSessionWithWinner('HIGH', 30);
      const empty = await endedSessionWithWinner('NOBODY', null);

      const page = async (sortOrder: 'asc' | 'desc', pageNumber: number) =>
        (
          await statsService.listPlayedSessions({
            page: pageNumber,
            pageSize: 2,
            sortBy: 'winner',
            sortOrder,
          })
        ).items.map((item) => item.gameSessionId);

      expect([...(await page('desc', 1)), ...(await page('desc', 2))]).toEqual([
        high.id,
        mid.id,
        low.id,
        empty.id,
      ]);
      expect([...(await page('asc', 1)), ...(await page('asc', 2))]).toEqual([
        empty.id,
        low.id,
        mid.id,
        high.id,
      ]);
    });
  });

  describe('sort agrees with the numbers the rows show', () => {
    async function seedDriftSessions() {
      // Departed team holds the highest total; the roster winner has 10.
      const quizA = await createQuiz('Drift A', [[100]]);
      const departedHigh = await createSession(quizA.quiz, 'DRIFTA', 'ended');
      const gone = await joinTeam(departedHigh, 'GoneA');
      const stayA = await joinTeam(departedHigh, 'StayA');
      await grade(departedHigh, quizA.questions[0][0], gone, 100);
      await grade(departedHigh, quizA.questions[0][0], stayA, 10);
      await em.nativeDelete(GameSessionTeam, {
        gameSession: departedHigh,
        team: gone,
      });

      // A penalty drops the answer leader (20 - 15) below the other team (8).
      const quizB = await createQuiz('Drift B', [[100]]);
      const penalty = await createSession(quizB.quiz, 'DRIFTB', 'ended');
      const leader = await joinTeam(penalty, 'LeaderB');
      const other = await joinTeam(penalty, 'OtherB');
      await grade(penalty, quizB.questions[0][0], leader, 20);
      await grade(penalty, quizB.questions[0][0], other, 8);
      await awardBonus(penalty, leader, -15);

      // No roster teams at all.
      const quizC = await createQuiz('Drift C', [[100]]);
      const empty = await createSession(quizC.quiz, 'DRIFTC', 'ended');

      // A single team whose whole total is a bonus award.
      const quizD = await createQuiz('Drift D', [[100]]);
      const bonusOnly = await createSession(quizD.quiz, 'DRIFTD', 'ended');
      const lucky = await joinTeam(bonusOnly, 'LuckyD');
      await awardBonus(bonusOnly, lucky, 12);

      return { departedHigh, penalty, empty, bonusOnly };
    }

    const allByWinner = (sortOrder: 'asc' | 'desc') =>
      statsService.listPlayedSessions({
        page: 1,
        pageSize: 20,
        sortBy: 'winner',
        sortOrder,
      });

    it('orders by the winning points shown, empty roster first ascending and last descending', async () => {
      const { departedHigh, penalty, empty, bonusOnly } =
        await seedDriftSessions();

      const asc = await allByWinner('asc');
      const desc = await allByWinner('desc');

      expect(asc.items.map((i) => i.gameSessionId)).toEqual([
        empty.id,
        penalty.id,
        departedHigh.id,
        bonusOnly.id,
      ]);
      expect(asc.items.map((i) => i.winnerPoints)).toEqual([null, 8, 10, 12]);
      expect(desc.items.map((i) => i.gameSessionId)).toEqual([
        bonusOnly.id,
        departedHigh.id,
        penalty.id,
        empty.id,
      ]);
    });

    it('orders by the team count shown, counting a departed team and a bonus-only team', async () => {
      const { departedHigh, penalty, empty, bonusOnly } =
        await seedDriftSessions();

      const sorted = (sortOrder: 'asc' | 'desc') =>
        statsService.listPlayedSessions({
          page: 1,
          pageSize: 20,
          sortBy: 'teamCount',
          sortOrder,
        });
      const asc = await sorted('asc');
      const desc = await sorted('desc');

      expect(asc.items.map((i) => i.teamCount)).toEqual([0, 1, 2, 2]);
      expect(asc.items.slice(0, 2).map((i) => i.gameSessionId)).toEqual([
        empty.id,
        bonusOnly.id,
      ]);
      expect(desc.items.map((i) => i.teamCount)).toEqual([2, 2, 1, 0]);
      expect(
        new Set(desc.items.slice(0, 2).map((i) => i.gameSessionId)),
      ).toEqual(new Set([departedHigh.id, penalty.id]));
      expect(desc.total).toBe(4);
    });

    it.each(['teamCount', 'winner'] as const)(
      'pages and totals correctly while sorting by %s',
      async (sortBy) => {
        const { departedHigh, penalty, empty, bonusOnly } =
          await seedDriftSessions();
        const pageOf = (pageNumber: number) =>
          statsService.listPlayedSessions({
            page: pageNumber,
            pageSize: 3,
            sortBy,
            sortOrder: 'asc',
          });

        const first = await pageOf(1);
        const second = await pageOf(2);

        // Ascending ties (two teams each in departedHigh/penalty by count) fall back to newest id first.
        const expectedOrder =
          sortBy === 'winner'
            ? [empty.id, penalty.id, departedHigh.id, bonusOnly.id]
            : [empty.id, bonusOnly.id, penalty.id, departedHigh.id];
        expect(first.items.map((i) => i.gameSessionId)).toEqual(
          expectedOrder.slice(0, 3),
        );
        expect(second.items.map((i) => i.gameSessionId)).toEqual(
          expectedOrder.slice(3),
        );
        expect([first.total, second.total]).toEqual([4, 4]);
        expect([first.page, second.page]).toEqual([1, 2]);
        expect([first.pageSize, second.pageSize]).toEqual([3, 3]);
      },
    );
  });

  it('orders sessions by playedAt (createdAt) descending by default', async () => {
    const { quiz } = await createQuiz('Quiz E', [[1]]);
    const older = await createSession(quiz, 'OLDER1', 'ended');
    await em
      .getConnection()
      .execute('update game_sessions set created_at = ? where id = ?', [
        new Date('2020-01-01'),
        older.id,
      ]);
    const newer = await createSession(quiz, 'NEWER1', 'ended');

    const result = await statsService.listPlayedSessions(defaultQuery);

    expect(result.items.map((row) => row.gameSessionId)).toEqual([
      newer.id,
      older.id,
    ]);
  });

  it('resolves name to the quiz title when no custom name was set', async () => {
    const { quiz } = await createQuiz('Quiz Default Name', [[1]]);
    await createSession(quiz, 'NONAME1', 'ended');

    const {
      items: [result],
    } = await statsService.listPlayedSessions(defaultQuery);

    expect(result.name).toBe('Quiz Default Name');
  });

  it('resolves name to the custom name when one was set at creation', async () => {
    const { quiz } = await createQuiz('Quiz L', [[1]]);
    await createSession(quiz, 'CUSTOMNAME1', 'ended', 'Week 3 Social');

    const {
      items: [result],
    } = await statsService.listPlayedSessions(defaultQuery);

    expect(result.name).toBe('Week 3 Social');
  });

  it('orders by quizTitle ascending when requested', async () => {
    const { quiz: quizB } = await createQuiz('Quiz Zebra', [[1]]);
    const { quiz: quizA } = await createQuiz('Quiz Apple', [[1]]);
    const sessionB = await createSession(quizB, 'ZEBRA1', 'ended');
    const sessionA = await createSession(quizA, 'APPLE1', 'ended');

    const result = await statsService.listPlayedSessions({
      ...defaultQuery,
      sortBy: 'quizTitle',
      sortOrder: 'asc',
    });

    expect(result.items.map((row) => row.gameSessionId)).toEqual([
      sessionA.id,
      sessionB.id,
    ]);
  });

  it('paginates results and reports the total across all pages', async () => {
    const { quiz } = await createQuiz('Quiz F', [[1]]);
    const sessions: GameSession[] = [];
    for (let i = 0; i < 3; i += 1) {
      sessions.push(await createSession(quiz, `PAGE${i}`, 'ended'));
    }

    const firstPage = await statsService.listPlayedSessions({
      ...defaultQuery,
      pageSize: 2,
    });
    const secondPage = await statsService.listPlayedSessions({
      ...defaultQuery,
      page: 2,
      pageSize: 2,
    });

    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.total).toBe(3);
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.total).toBe(3);
    const allIds = [...firstPage.items, ...secondPage.items].map(
      (row) => row.gameSessionId,
    );
    expect(new Set(allIds)).toEqual(new Set(sessions.map((s) => s.id)));
  });

  describe('getSessionDetail', () => {
    it('throws NotFoundException for a session that does not exist', async () => {
      await expect(statsService.getSessionDetail(999999)).rejects.toThrow(
        'Ended session 999999 does not exist',
      );
    });

    it('throws NotFoundException for a session that is not ended', async () => {
      const { quiz } = await createQuiz('Quiz F', [[1]]);
      const lobby = await createSession(quiz, 'LOBBY2', 'lobby');

      await expect(statsService.getSessionDetail(lobby.id)).rejects.toThrow(
        `Ended session ${lobby.id} does not exist`,
      );
    });

    it('wires session/team/round/question/answer/bonus rows into the computed detail', async () => {
      const { quiz, questions } = await createQuiz('Quiz G', [[5, 5]]);
      const session = await createSession(quiz, 'DETAIL1', 'ended');
      const [q1, q2] = questions[0];
      const teamA = await joinTeam(session, 'Team A');
      const teamB = await joinTeam(session, 'Team B');
      await grade(session, q1, teamA, 5);
      await grade(session, q2, teamB, 0);
      await awardBonus(session, teamA, 2);

      const result = await statsService.getSessionDetail(session.id);

      expect(result.gameSessionId).toBe(session.id);
      expect(result.quizTitle).toBe('Quiz G');
      expect(result.teamCount).toBe(2);
      expect(result.maxPoints).toBe(10);
      expect(result.standings.map((s) => s.teamName)).toEqual([
        'Team A',
        'Team B',
      ]);
      expect(result.standings[0]).toMatchObject({
        teamName: 'Team A',
        answerPoints: 5,
        bonusPoints: 2,
        total: 7,
      });
      expect(result.questions).toHaveLength(2);
    });

    it('resolves name to the custom name when one was set, else the quiz title', async () => {
      const { quiz: namedQuiz } = await createQuiz('Quiz M', [[1]]);
      const named = await createSession(
        namedQuiz,
        'NAMED1',
        'ended',
        'Week 3 Social',
      );
      const { quiz: unnamedQuiz } = await createQuiz('Quiz N', [[1]]);
      const unnamed = await createSession(unnamedQuiz, 'UNNAMED1', 'ended');

      const namedResult = await statsService.getSessionDetail(named.id);
      const unnamedResult = await statsService.getSessionDetail(unnamed.id);

      expect(namedResult.name).toBe('Week 3 Social');
      expect(unnamedResult.name).toBe('Quiz N');
    });

    it('words each correct answer and team answer the way the screens show it', async () => {
      const { quiz, questions } = await createQuiz('Quiz W', [[1]]);
      const round = questions[0][0].round;
      const sortQuestion = em.create(Question, {
        round,
        orderIndex: 1,
        type: 'sort',
        prompt: 'Order the planets',
        answer: 'Mercury|Venus|Earth',
        payload: { options: ['Venus', 'Earth', 'Mercury'] },
        points: 1,
      });
      await em.flush();
      const session = await createSession(quiz, 'WORDED1', 'ended');
      const team = await joinTeam(session, 'Team A');
      em.create(Answer, {
        gameSession: session,
        question: sortQuestion,
        team,
        value: 'Venus|Mercury|Earth',
        pointsAwarded: 0,
        gradedAt: new Date(),
        verdict: 'incorrect',
      });
      await em.flush();

      const result = await statsService.getSessionDetail(session.id);

      expect(result.questions.map((q) => q.answer)).toEqual([
        'answer',
        'Mercury → Venus → Earth',
      ]);
      expect(result.scoresheet).toEqual([
        {
          teamId: team.id,
          questionId: sortQuestion.id,
          pointsAwarded: 0,
          verdict: 'incorrect',
          answer: 'Venus → Mercury → Earth',
        },
      ]);
    });

    it('still counts a team that was kicked/left after answering, so correctRate cannot exceed 100%', async () => {
      const { quiz, questions } = await createQuiz('Quiz H', [[10]]);
      const session = await createSession(quiz, 'KICKED1', 'ended');
      const [q1] = questions[0];
      const teamA = await joinTeam(session, 'Team A');
      const teamB = await joinTeam(session, 'Team B');
      await grade(session, q1, teamA, 10);
      await grade(session, q1, teamB, 10);

      // Team B leaves/gets kicked after answering: roster row is hard-deleted,
      // but its graded answer remains (TeamService.removeFromRoster).
      await em.nativeDelete(GameSessionTeam, {
        gameSession: session,
        team: teamB,
      });

      const result = await statsService.getSessionDetail(session.id);

      expect(result.teamCount).toBe(2);
      expect(result.questions[0].correctRate).toBe(1);
    });
  });

  describe('getSessionDetail round ratings', () => {
    async function rate(
      session: GameSession,
      round: Round,
      team: Team,
      stars: number,
    ): Promise<void> {
      em.create(RoundRating, { gameSession: session, round, team, stars });
      await em.flush();
    }

    it('reports each round’s average and count, and null for an unrated round', async () => {
      const { quiz, questions } = await createQuiz('Quiz', [[1], [1], [1]]);
      const session = await createSession(quiz, 'RATED1', 'ended');
      const alpha = await joinTeam(session, 'Alpha');
      const beta = await joinTeam(session, 'Beta');
      const gamma = await joinTeam(session, 'Gamma');
      await rate(session, questions[0][0].round, alpha, 5);
      await rate(session, questions[0][0].round, beta, 4);
      await rate(session, questions[0][0].round, gamma, 4.5);
      await rate(session, questions[1][0].round, alpha, 2);

      const result = await statsService.getSessionDetail(session.id);

      expect(result.rounds.map((r) => r.rating)).toEqual([
        { average: 13.5 / 3, count: 3 },
        { average: 2, count: 1 },
        null,
      ]);
    });

    it('ignores ratings from another session of the same quiz', async () => {
      const { quiz, questions } = await createQuiz('Quiz', [[1]]);
      const session = await createSession(quiz, 'RATED2', 'ended');
      const other = await createSession(quiz, 'RATED3', 'ended');
      const team = await joinTeam(other, 'Alpha');
      await rate(other, questions[0][0].round, team, 5);

      const result = await statsService.getSessionDetail(session.id);

      expect(result.rounds[0].rating).toBeNull();
    });

    it('carries no team id or name for any rating', async () => {
      const { quiz, questions } = await createQuiz('Quiz', [[1]]);
      const session = await createSession(quiz, 'RATED4', 'ended');
      const team = await joinTeam(session, 'SecretSquad');
      await rate(session, questions[0][0].round, team, 3);

      const result = await statsService.getSessionDetail(session.id);

      expect(Object.keys(result.rounds[0].rating ?? {}).sort()).toEqual([
        'average',
        'count',
      ]);
    });
  });

  describe('getFeedbackTrends sessions', () => {
    async function playedSession(
      joinCode: string,
      playedAt: string,
      options: {
        name?: string;
        feedbackOff?: boolean;
        status?: GameStatus;
      } = {},
    ): Promise<{ session: GameSession; round: Round }> {
      const { quiz, questions } = await createQuiz(`Quiz ${joinCode}`, [[1]]);
      const session = await createSession(
        quiz,
        joinCode,
        options.status ?? 'ended',
        options.name,
      );
      session.createdAt = new Date(playedAt);
      if (options.feedbackOff) {
        session.settings = {
          ...DEFAULT_SESSION_SETTINGS,
          collectFeedback: false,
        };
      }
      await em.flush();
      return { session, round: questions[0][0].round };
    }

    async function rate(
      session: GameSession,
      round: Round,
      teamName: string,
      stars: number,
    ): Promise<void> {
      const team = await joinTeam(session, teamName);
      em.create(RoundRating, { gameSession: session, round, team, stars });
      await em.flush();
    }

    it('lists ended sessions oldest first with their average rating and rating count', async () => {
      const newer = await playedSession('TR1', '2026-10-10T19:00:00Z', {
        name: 'Autumn quiz',
      });
      const older = await playedSession('TR2', '2026-09-01T19:00:00Z');
      await rate(newer.session, newer.round, 'A1', 5);
      await rate(newer.session, newer.round, 'A2', 4);
      await rate(older.session, older.round, 'B1', 3);

      const result = await statsService.getFeedbackTrends({});

      expect(result.sessions).toEqual([
        {
          id: older.session.id,
          name: 'Quiz TR2',
          date: '2026-09-01T19:00:00.000Z',
          rating: { average: 3, count: 1 },
        },
        {
          id: newer.session.id,
          name: 'Autumn quiz',
          date: '2026-10-10T19:00:00.000Z',
          rating: { average: 4.5, count: 2 },
        },
      ]);
    });

    it('averages across all of a session’s rounds, not per round', async () => {
      const { quiz, questions } = await createQuiz('Two rounds', [[1], [1]]);
      const session = await createSession(quiz, 'TR3', 'ended');
      await rate(session, questions[0][0].round, 'A1', 5);
      await rate(session, questions[0][0].round, 'A2', 5);
      await rate(session, questions[1][0].round, 'A3', 2);

      const result = await statsService.getFeedbackTrends({});

      expect(result.sessions[0].rating).toEqual({ average: 4, count: 3 });
    });

    it('shows null for an ended session nobody rated', async () => {
      await playedSession('TR4', '2026-10-01T19:00:00Z');

      const result = await statsService.getFeedbackTrends({});

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].rating).toBeNull();
    });

    it('leaves out sessions with feedback off and sessions that have not ended', async () => {
      const off = await playedSession('TR5', '2026-10-01T19:00:00Z', {
        feedbackOff: true,
      });
      await rate(off.session, off.round, 'A1', 1);
      await playedSession('TR6', '2026-10-02T19:00:00Z', {
        status: 'question_open',
      });
      const on = await playedSession('TR7', '2026-10-03T19:00:00Z');

      const result = await statsService.getFeedbackTrends({});

      expect(result.sessions.map((s) => s.id)).toEqual([on.session.id]);
    });

    it('counts a session stored without the setting as feedback on', async () => {
      const { session } = await playedSession('TR8', '2026-10-01T19:00:00Z');
      const withoutSetting: Partial<typeof DEFAULT_SESSION_SETTINGS> = {
        ...DEFAULT_SESSION_SETTINGS,
      };
      delete withoutSetting.collectFeedback;
      session.settings = withoutSetting as typeof session.settings;
      await em.flush();

      const result = await statsService.getFeedbackTrends({});

      expect(result.sessions.map((s) => s.id)).toEqual([session.id]);
    });

    it('keeps only sessions played from the from date to the end of the to date, UTC', async () => {
      await playedSession('TR9', '2026-09-30T23:59:59Z');
      const first = await playedSession('TR10', '2026-10-01T00:00:00Z');
      const last = await playedSession('TR11', '2026-10-31T23:59:59Z');
      await playedSession('TR12', '2026-11-01T00:00:00Z');

      const bounded = await statsService.getFeedbackTrends({
        from: '2026-10-01',
        to: '2026-10-31',
      });
      const fromOnly = await statsService.getFeedbackTrends({
        from: '2026-10-31',
      });
      const toOnly = await statsService.getFeedbackTrends({ to: '2026-09-30' });

      expect(bounded.sessions.map((s) => s.id)).toEqual([
        first.session.id,
        last.session.id,
      ]);
      expect(fromOnly.sessions.map((s) => s.id)).toContain(last.session.id);
      expect(fromOnly.sessions).toHaveLength(2);
      expect(toOnly.sessions).toHaveLength(1);
    });

    it('with a leagueId reads only that league member sessions, ignoring from/to', async () => {
      const member = await playedSession('TL1', '2026-01-05T19:00:00Z');
      const outsider = await playedSession('TL2', '2026-10-05T19:00:00Z');
      await rate(member.session, member.round, 'L1', 5);
      await rate(outsider.session, outsider.round, 'L2', 1);
      const league = em.create(League, {
        name: 'Autumn',
        startsOn: '2026-09-01',
        endsOn: '2026-12-01',
      });
      await em.flush();
      em.create(LeagueSession, { league, gameSession: member.session });
      await em.flush();

      const result = await statsService.getFeedbackTrends({
        leagueId: league.id,
        from: '2026-10-01',
        to: '2026-10-31',
      });

      expect(result.sessions.map((s) => s.id)).toEqual([member.session.id]);
      expect(result.sessions[0].rating).toEqual({ average: 5, count: 1 });
    });

    it('rejects an unknown leagueId as not found', async () => {
      await expect(
        statsService.getFeedbackTrends({ leagueId: 9999 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('carries no team id or name', async () => {
      const { session, round } = await playedSession(
        'TR13',
        '2026-10-01T19:00:00Z',
      );
      await rate(session, round, 'SecretSquad', 3);

      const result = await statsService.getFeedbackTrends({});

      const json = JSON.stringify(result);
      expect(json).not.toContain('SecretSquad');
      expect(json).not.toMatch(/team/i);
    });
  });

  describe('getFeedbackTrends topics', () => {
    async function endedAt(
      joinCode: string,
      playedAt: string,
      feedbackOff = false,
    ): Promise<GameSession> {
      const { quiz } = await createQuiz(`Quiz ${joinCode}`, [[1]]);
      const session = await createSession(quiz, joinCode, 'ended');
      session.createdAt = new Date(playedAt);
      if (feedbackOff) {
        session.settings = {
          ...DEFAULT_SESSION_SETTINGS,
          collectFeedback: false,
        };
      }
      await em.flush();
      return session;
    }

    async function suggest(
      session: GameSession,
      teamName: string,
      topics: string[],
      sentAt: string,
    ): Promise<void> {
      const team = await joinTeam(session, teamName);
      em.create(SessionFeedback, {
        gameSession: session,
        team,
        comment: '',
        topics,
        createdAt: new Date(sentAt),
        updatedAt: new Date(sentAt),
      });
      await em.flush();
    }

    it('merges the same topic from different sessions, showing the most common spelling, sorted by count then name', async () => {
      const first = await endedAt('TT1', '2026-09-01T19:00:00Z');
      const second = await endedAt('TT2', '2026-10-01T19:00:00Z');
      await suggest(first, 'A1', ['geography', 'Film'], '2026-09-01T20:00:00Z');
      await suggest(first, 'A2', ['Geography'], '2026-09-01T20:05:00Z');
      await suggest(second, 'B1', [' Geography '], '2026-10-01T20:00:00Z');
      await suggest(
        second,
        'B2',
        ['GEOGRAPHY', 'film', 'Art'],
        '2026-10-01T20:05:00Z',
      );

      const result = await statsService.getFeedbackTrends({});

      expect(result.topics).toEqual([
        { topic: 'Geography', count: 4 },
        { topic: 'Film', count: 2 },
        { topic: 'Art', count: 1 },
      ]);
    });

    it('counts only sessions in the range with feedback on, and carries no team', async () => {
      const inRange = await endedAt('TT3', '2026-10-05T19:00:00Z');
      const before = await endedAt('TT4', '2026-08-05T19:00:00Z');
      const off = await endedAt('TT5', '2026-10-06T19:00:00Z', true);
      await suggest(inRange, 'SecretSquad', ['Music'], '2026-10-05T20:00:00Z');
      await suggest(before, 'B1', ['Sport'], '2026-08-05T20:00:00Z');
      await suggest(off, 'C1', ['Cooking'], '2026-10-06T20:00:00Z');

      const result = await statsService.getFeedbackTrends({
        from: '2026-10-01',
      });

      expect(result.topics).toEqual([{ topic: 'Music', count: 1 }]);
      expect(JSON.stringify(result)).not.toContain('SecretSquad');
    });

    it('is empty when nobody suggested a topic', async () => {
      await endedAt('TT6', '2026-10-05T19:00:00Z');

      const result = await statsService.getFeedbackTrends({});

      expect(result.topics).toEqual([]);
    });
  });

  describe('getFeedbackTrends best and worst rounds', () => {
    async function ratedRound(
      joinCode: string,
      playedAt: string,
      stars: number[],
      options: { sessionName?: string; feedbackOff?: boolean } = {},
    ): Promise<GameSession> {
      const { quiz, questions } = await createQuiz(`Quiz ${joinCode}`, [[1]]);
      const round = questions[0][0].round;
      round.title = `Round of ${joinCode}`;
      const session = await createSession(
        quiz,
        joinCode,
        'ended',
        options.sessionName,
      );
      session.createdAt = new Date(playedAt);
      if (options.feedbackOff) {
        session.settings = {
          ...DEFAULT_SESSION_SETTINGS,
          collectFeedback: false,
        };
      }
      await em.flush();
      for (const [index, value] of stars.entries()) {
        const team = await joinTeam(session, `${joinCode}-T${index}`);
        em.create(RoundRating, {
          gameSession: session,
          round,
          team,
          stars: value,
        });
      }
      await em.flush();
      return session;
    }

    it('ranks rounds by average rating, best first and worst first', async () => {
      const low = await ratedRound('BW1', '2026-10-01T19:00:00Z', [1, 2, 3]);
      const mid = await ratedRound('BW2', '2026-10-02T19:00:00Z', [3, 3, 4]);
      const high = await ratedRound('BW3', '2026-10-03T19:00:00Z', [5, 5, 4]);

      const result = await statsService.getFeedbackTrends({});

      expect(result.bestRounds.map((r) => r.sessionId)).toEqual([
        high.id,
        mid.id,
        low.id,
      ]);
      expect(result.worstRounds.map((r) => r.sessionId)).toEqual([
        low.id,
        mid.id,
        high.id,
      ]);
      expect(result.bestRounds[0]).toEqual({
        sessionId: high.id,
        sessionName: 'Quiz BW3',
        roundTitle: 'Round of BW3',
        average: 14 / 3,
        count: 3,
      });
    });

    it('counts only rounds with at least 3 ratings', async () => {
      await ratedRound('BW4', '2026-10-01T19:00:00Z', [5, 5]);
      const enough = await ratedRound('BW5', '2026-10-02T19:00:00Z', [2, 2, 2]);

      const result = await statsService.getFeedbackTrends({});

      expect(result.bestRounds.map((r) => r.sessionId)).toEqual([enough.id]);
      expect(result.worstRounds.map((r) => r.sessionId)).toEqual([enough.id]);
    });

    it('keeps only 5 rounds in each list', async () => {
      for (let i = 0; i < 7; i += 1) {
        await ratedRound(`BW6${i}`, `2026-10-0${i + 1}T19:00:00Z`, [
          1 + i * 0.5,
          1 + i * 0.5,
          1 + i * 0.5,
        ]);
      }

      const result = await statsService.getFeedbackTrends({});

      expect(result.bestRounds.map((r) => r.average)).toEqual([
        4, 3.5, 3, 2.5, 2,
      ]);
      expect(result.worstRounds.map((r) => r.average)).toEqual([
        1, 1.5, 2, 2.5, 3,
      ]);
    });

    it('breaks a tie by higher count first, then the newer session', async () => {
      const fewer = await ratedRound('BW7', '2026-10-05T19:00:00Z', [4, 4, 4]);
      const olderMore = await ratedRound(
        'BW8',
        '2026-10-01T19:00:00Z',
        [4, 4, 4, 4],
      );
      const newerMore = await ratedRound(
        'BW9',
        '2026-10-02T19:00:00Z',
        [4, 4, 4, 4],
      );

      const result = await statsService.getFeedbackTrends({});

      const expected = [newerMore.id, olderMore.id, fewer.id];
      expect(result.bestRounds.map((r) => r.sessionId)).toEqual(expected);
      expect(result.worstRounds.map((r) => r.sessionId)).toEqual(expected);
    });

    it('uses the session name when set and honours the range and the feedback setting', async () => {
      const named = await ratedRound(
        'BW10',
        '2026-10-10T19:00:00Z',
        [3, 3, 3],
        {
          sessionName: 'Freshers night',
        },
      );
      await ratedRound('BW11', '2026-08-10T19:00:00Z', [5, 5, 5]);
      await ratedRound('BW12', '2026-10-11T19:00:00Z', [5, 5, 5], {
        feedbackOff: true,
      });

      const result = await statsService.getFeedbackTrends({
        from: '2026-10-01',
      });

      expect(result.bestRounds).toEqual([
        {
          sessionId: named.id,
          sessionName: 'Freshers night',
          roundTitle: 'Round of BW10',
          average: 3,
          count: 3,
        },
      ]);
    });

    it('returns empty lists when nothing qualifies and carries no team data', async () => {
      const empty = await statsService.getFeedbackTrends({});
      await ratedRound('BW13', '2026-10-01T19:00:00Z', [3, 3, 3]);

      const result = await statsService.getFeedbackTrends({});

      expect(empty.bestRounds).toEqual([]);
      expect(empty.worstRounds).toEqual([]);
      expect(JSON.stringify(result.bestRounds)).not.toMatch(/team|BW13-T/i);
    });
  });

  describe('getSessionDetail feedback', () => {
    async function send(
      session: GameSession,
      team: Team,
      comment: string,
      topics: string[],
      sentAt: string,
    ): Promise<void> {
      em.create(SessionFeedback, {
        gameSession: session,
        team,
        comment,
        topics,
        createdAt: new Date(sentAt),
        updatedAt: new Date(sentAt),
      });
      await em.flush();
    }

    async function endedSession(joinCode: string): Promise<GameSession> {
      const { quiz } = await createQuiz('Quiz', [[1]]);
      return createSession(quiz, joinCode, 'ended');
    }

    it('lists comments newest first, skipping empty ones, with no team id or name', async () => {
      const session = await endedSession('FB1');
      const alpha = await joinTeam(session, 'SecretSquad');
      const beta = await joinTeam(session, 'Beta');
      const gamma = await joinTeam(session, 'Gamma');
      await send(session, alpha, 'Loved it', [], '2026-10-01T20:00:00Z');
      await send(session, beta, '   ', ['Film'], '2026-10-01T20:05:00Z');
      await send(session, gamma, 'Too loud', [], '2026-10-01T20:10:00Z');

      const result = await statsService.getSessionDetail(session.id);

      expect(result.feedback.comments).toEqual([
        { text: 'Too loud', submittedAt: '2026-10-01T20:10:00.000Z' },
        { text: 'Loved it', submittedAt: '2026-10-01T20:00:00.000Z' },
      ]);
      const json = JSON.stringify(result.feedback);
      expect(json).not.toContain('SecretSquad');
      expect(json).not.toMatch(/team/i);
    });

    it('counts differently capitalised and spaced topics as one, in the most common spelling', async () => {
      const session = await endedSession('FB2');
      const alpha = await joinTeam(session, 'Alpha');
      const beta = await joinTeam(session, 'Beta');
      const gamma = await joinTeam(session, 'Gamma');
      const delta = await joinTeam(session, 'Delta');
      await send(session, alpha, '', ['Geography'], '2026-10-01T20:00:00Z');
      await send(session, beta, '', [' geography '], '2026-10-01T20:01:00Z');
      await send(session, gamma, '', ['GEOGRAPHY'], '2026-10-01T20:02:00Z');
      await send(session, delta, '', ['Geography'], '2026-10-01T20:03:00Z');

      const result = await statsService.getSessionDetail(session.id);

      expect(result.feedback.topics).toEqual([
        { topic: 'Geography', count: 4 },
      ]);
    });

    it('sorts topic groups by count, then alphabetically', async () => {
      const session = await endedSession('FB3');
      const alpha = await joinTeam(session, 'Alpha');
      const beta = await joinTeam(session, 'Beta');
      await send(
        session,
        alpha,
        '',
        ['Music', 'Art', 'Film'],
        '2026-10-01T20:00:00Z',
      );
      await send(session, beta, '', ['film'], '2026-10-01T20:01:00Z');

      const result = await statsService.getSessionDetail(session.id);

      expect(result.feedback.topics).toEqual([
        { topic: 'Film', count: 2 },
        { topic: 'Art', count: 1 },
        { topic: 'Music', count: 1 },
      ]);
    });

    it('reports collected: true by default and for a session stored without the setting', async () => {
      const session = await endedSession('FB4');
      const legacy = await endedSession('FB5');
      const withoutSetting: Partial<typeof DEFAULT_SESSION_SETTINGS> = {
        ...DEFAULT_SESSION_SETTINGS,
      };
      delete withoutSetting.collectFeedback;
      legacy.settings = withoutSetting as typeof legacy.settings;
      await em.flush();

      const result = await statsService.getSessionDetail(session.id);
      const legacyResult = await statsService.getSessionDetail(legacy.id);

      expect(result.feedback.collected).toBe(true);
      expect(legacyResult.feedback.collected).toBe(true);
    });

    it('reports collected: false for a session with the setting off', async () => {
      const session = await endedSession('FB6');
      session.settings = {
        ...DEFAULT_SESSION_SETTINGS,
        collectFeedback: false,
      };
      await em.flush();

      const result = await statsService.getSessionDetail(session.id);

      expect(result.feedback).toEqual({
        collected: false,
        comments: [],
        topics: [],
      });
    });

    it('ignores feedback from another session', async () => {
      const session = await endedSession('FB7');
      const other = await endedSession('FB8');
      const team = await joinTeam(other, 'Alpha');
      await send(other, team, 'Hello', ['Film'], '2026-10-01T20:00:00Z');

      const result = await statsService.getSessionDetail(session.id);

      expect(result.feedback.comments).toEqual([]);
      expect(result.feedback.topics).toEqual([]);
    });
  });

  describe('getSessionDetail standings', () => {
    async function leave(session: GameSession, team: Team): Promise<void> {
      await em.nativeDelete(GameSessionTeam, { gameSession: session, team });
    }

    it('gives tied teams a shared rank and marks the single winner by name order when the tie was never broken', async () => {
      const { quiz, questions } = await createQuiz('Quiz T', [[5]]);
      const session = await createSession(quiz, 'TIED1', 'ended');
      const [q1] = questions[0];
      const zed = await joinTeam(session, 'Zed');
      const amy = await joinTeam(session, 'Amy');
      const last = await joinTeam(session, 'Last');
      await grade(session, q1, zed, 5);
      await grade(session, q1, amy, 5);
      await grade(session, q1, last, 1);

      const { standings } = await statsService.getSessionDetail(session.id);

      expect(
        standings.map((s) => [s.teamName, s.rank, s.rankTo, s.isWinner]),
      ).toEqual([
        ['Amy', 1, 2, true],
        ['Zed', 1, 2, false],
        ['Last', 3, 3, false],
      ]);
    });

    it('names the showdown winner as the single winner of a tie', async () => {
      const { quiz, questions } = await createQuiz('Quiz S', [[5]]);
      const session = await createSession(quiz, 'SHOWDOWN1', 'ended');
      const [q1] = questions[0];
      const amy = await joinTeam(session, 'Amy');
      const zed = await joinTeam(session, 'Zed');
      await grade(session, q1, amy, 5);
      await grade(session, q1, zed, 5);
      await awardBonus(session, zed, 1);

      const { standings } = await statsService.getSessionDetail(session.id);

      expect(standings.map((s) => [s.teamName, s.rank, s.isWinner])).toEqual([
        ['Zed', 1, true],
        ['Amy', 2, false],
      ]);
    });

    it('lists a kicked high scorer last, unranked and marked as having left, never the winner', async () => {
      const { quiz, questions } = await createQuiz('Quiz K', [[10]]);
      const session = await createSession(quiz, 'KICKED2', 'ended');
      const [q1] = questions[0];
      const cheater = await joinTeam(session, 'Cheater');
      const honest = await joinTeam(session, 'Honest');
      await grade(session, q1, cheater, 10);
      await grade(session, q1, honest, 3);
      await leave(session, cheater);

      const result = await statsService.getSessionDetail(session.id);

      expect(
        result.standings.map((s) => [
          s.teamName,
          s.rank,
          s.hasLeft,
          s.isWinner,
        ]),
      ).toEqual([
        ['Honest', 1, false, true],
        ['Cheater', null, true, false],
      ]);
      expect(result.teamCount).toBe(2);
      expect(result.highlights.winningMargin).toBeNull();
    });

    it('counts a team that left with only a bonus as a participant', async () => {
      const { quiz } = await createQuiz('Quiz B', [[5]]);
      const session = await createSession(quiz, 'BONUSLEFT1', 'ended');
      const leaver = await joinTeam(session, 'Leaver');
      await joinTeam(session, 'Stayer');
      await awardBonus(session, leaver, 2);
      await leave(session, leaver);

      const result = await statsService.getSessionDetail(session.id);

      expect(result.teamCount).toBe(2);
      expect(result.standings.map((s) => s.teamName)).toEqual([
        'Stayer',
        'Leaver',
      ]);
    });
  });

  describe('player counts', () => {
    async function report(
      session: GameSession,
      team: Team,
      playerCount: number,
    ): Promise<void> {
      em.create(SessionPlayerCount, {
        gameSession: session,
        team,
        playerCount,
      });
      await em.flush();
    }

    it('totals the known counts, leaves out teams that gave none and reports how many gave one', async () => {
      const { quiz } = await createQuiz('Quiz P', [[5]]);
      const session = await createSession(quiz, 'PLAYERS1', 'ended');
      const amy = await joinTeam(session, 'Amy');
      const bob = await joinTeam(session, 'Bob');
      await joinTeam(session, 'Silent');
      await report(session, amy, 4);
      await report(session, bob, 3);

      const detail = await statsService.getSessionDetail(session.id);

      expect(detail.playerCount).toEqual({
        total: 7,
        average: 3.5,
        reportedTeams: 2,
      });
    });

    it('has a null average and a zero total when nobody reported', async () => {
      const { quiz } = await createQuiz('Quiz P', [[5]]);
      const session = await createSession(quiz, 'PLAYERS2', 'ended');
      await joinTeam(session, 'Silent');

      const detail = await statsService.getSessionDetail(session.id);

      expect(detail.playerCount).toEqual({
        total: 0,
        average: null,
        reportedTeams: 0,
      });
    });

    it('still includes the count of a team that left', async () => {
      const { quiz, questions } = await createQuiz('Quiz P', [[5]]);
      const session = await createSession(quiz, 'PLAYERS3', 'ended');
      const leaver = await joinTeam(session, 'Leaver');
      const stayer = await joinTeam(session, 'Stayer');
      await grade(session, questions[0][0], leaver, 5);
      await report(session, leaver, 5);
      await report(session, stayer, 2);
      await em.nativeDelete(GameSessionTeam, {
        gameSession: session,
        team: leaver,
      });

      const detail = await statsService.getSessionDetail(session.id);

      expect(detail.playerCount.total).toBe(7);
      expect(detail.standings.map((s) => [s.teamName, s.playerCount])).toEqual([
        ['Stayer', 2],
        ['Leaver', 5],
      ]);
    });

    it('gives each standing row its count, null when unknown', async () => {
      const { quiz, questions } = await createQuiz('Quiz P', [[5]]);
      const session = await createSession(quiz, 'PLAYERS4', 'ended');
      const amy = await joinTeam(session, 'Amy');
      const silent = await joinTeam(session, 'Silent');
      await grade(session, questions[0][0], amy, 5);
      await report(session, amy, 6);

      const detail = await statsService.getSessionDetail(session.id);

      expect(detail.standings.map((s) => [s.teamId, s.playerCount])).toEqual([
        [amy.id, 6],
        [silent.id, null],
      ]);
    });

    it('lists the total players of each session, null when nobody reported', async () => {
      const { quiz } = await createQuiz('Quiz P', [[5]]);
      const reported = await createSession(quiz, 'PLAYERS5', 'ended');
      const unreported = await createSession(quiz, 'PLAYERS6', 'ended');
      const amy = await joinTeam(reported, 'Amy');
      const bob = await joinTeam(reported, 'Bob');
      await joinTeam(unreported, 'Silent');
      await report(reported, amy, 4);
      await report(reported, bob, 2);

      const { items } = await statsService.listPlayedSessions(defaultQuery);

      expect(
        items.map((i) => [i.gameSessionId, i.totalPlayers]).sort(),
      ).toEqual(
        [
          [reported.id, 6],
          [unreported.id, null],
        ].sort(),
      );
    });
  });

  describe('deleteSession', () => {
    it('throws NotFoundException for a session that does not exist', async () => {
      await expect(statsService.deleteSession(999999)).rejects.toThrow(
        'Ended session 999999 does not exist',
      );
    });

    it('throws NotFoundException for a session that is not ended', async () => {
      const { quiz } = await createQuiz('Quiz I', [[1]]);
      const lobby = await createSession(quiz, 'LOBBY3', 'lobby');

      await expect(statsService.deleteSession(lobby.id)).rejects.toThrow(
        `Ended session ${lobby.id} does not exist`,
      );
    });

    it('removes the session and every answer/bonus/roster row tied to it via cascade', async () => {
      const { quiz, questions } = await createQuiz('Quiz J', [[5]]);
      const session = await createSession(quiz, 'DELETE1', 'ended');
      const [q1] = questions[0];
      const teamA = await joinTeam(session, 'Team A');
      await grade(session, q1, teamA, 5);
      await awardBonus(session, teamA, 2);

      await statsService.deleteSession(session.id);

      expect(await em.findOne(GameSession, { id: session.id })).toBeNull();
      expect(await em.count(Answer, { gameSession: session.id })).toBe(0);
      expect(await em.count(BonusAward, { gameSession: session.id })).toBe(0);
      expect(await em.count(GameSessionTeam, { gameSession: session.id })).toBe(
        0,
      );
    });

    it('leaves other sessions untouched', async () => {
      const { quiz } = await createQuiz('Quiz K', [[1]]);
      const toDelete = await createSession(quiz, 'DELETE2', 'ended');
      const toKeep = await createSession(quiz, 'KEEP1', 'ended');

      await statsService.deleteSession(toDelete.id);

      expect(await em.findOne(GameSession, { id: toKeep.id })).not.toBeNull();
    });
  });

  describe('renameSession', () => {
    it('throws NotFoundException for a session that does not exist', async () => {
      await expect(
        statsService.renameSession(999999, 'New Name'),
      ).rejects.toThrow('Ended session 999999 does not exist');
    });

    it('throws NotFoundException for a session that is not ended', async () => {
      const { quiz } = await createQuiz('Quiz L', [[1]]);
      const lobby = await createSession(quiz, 'LOBBY4', 'lobby');

      await expect(
        statsService.renameSession(lobby.id, 'New Name'),
      ).rejects.toThrow(`Ended session ${lobby.id} does not exist`);
    });

    it('sets a custom display name, reflected in a subsequent listing', async () => {
      const { quiz } = await createQuiz('Quiz M', [[1]]);
      const session = await createSession(quiz, 'RENAME1', 'ended');

      await statsService.renameSession(session.id, 'Week 3 Social');

      const {
        items: [result],
      } = await statsService.listPlayedSessions(defaultQuery);
      expect(result.name).toBe('Week 3 Social');
    });

    it('trims the given name before storing it', async () => {
      const { quiz } = await createQuiz('Quiz N', [[1]]);
      const session = await createSession(quiz, 'RENAME2', 'ended');

      await statsService.renameSession(session.id, '  Week 3 Social  ');

      const reloaded = await em.findOneOrFail(GameSession, { id: session.id });
      expect(reloaded.name).toBe('Week 3 Social');
    });

    it('clears a custom name back to the quiz title default when given a blank name', async () => {
      const { quiz } = await createQuiz('Quiz O', [[1]]);
      const session = await createSession(
        quiz,
        'RENAME3',
        'ended',
        'Old Custom Name',
      );

      await statsService.renameSession(session.id, '   ');

      const {
        items: [result],
      } = await statsService.listPlayedSessions(defaultQuery);
      expect(result.name).toBe('Quiz O');
    });
  });
});
