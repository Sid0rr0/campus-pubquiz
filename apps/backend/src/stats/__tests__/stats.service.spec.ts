import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { MikroORM, type EntityManager } from '@mikro-orm/postgresql';
import { Answer } from '@/db/entities/answer.entity';
import { BonusAward } from '@/db/entities/bonus-award.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { Team } from '@/db/entities/team.entity';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';
import { StatsService } from '@/stats/stats.service';

describe('StatsService (Postgres integration)', () => {
  let container: StartedPostgreSqlContainer;
  let orm: MikroORM;
  let em: EntityManager;
  let statsService: StatsService;

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

  beforeEach(() => {
    em = orm.em.fork();
    statsService = new StatsService(
      em.getRepository<GameSession, GameSessionRepository>(GameSession),
    );
  });

  afterEach(async () => {
    await em
      .getConnection()
      .execute(
        'TRUNCATE answers, bonus_awards, game_session_teams, teams, game_sessions, questions, rounds, quizzes CASCADE',
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
    status: string,
  ): Promise<GameSession> {
    const session = em.create(GameSession, { quiz, joinCode, status });
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

  it('only lists sessions with status "ended"', async () => {
    const { quiz } = await createQuiz('Quiz A', [[1]]);
    await createSession(quiz, 'LOBBY1', 'lobby');
    const ended = await createSession(quiz, 'ENDED1', 'ended');

    const result = await statsService.listPlayedSessions();

    expect(result).toHaveLength(1);
    expect(result[0].gameSessionId).toBe(ended.id);
  });

  it('sums the points of every question across every round for maxPoints', async () => {
    const { quiz } = await createQuiz('Quiz B', [[1, 2], [3]]);
    await createSession(quiz, 'MAXPTS', 'ended');

    const [result] = await statsService.listPlayedSessions();

    expect(result.maxPoints).toBe(6);
  });

  it('reports a zero teamCount and null winner fields when no teams joined', async () => {
    const { quiz } = await createQuiz('Quiz C', [[1]]);
    await createSession(quiz, 'EMPTY1', 'ended');

    const [result] = await statsService.listPlayedSessions();

    expect(result.teamCount).toBe(0);
    expect(result.winnerTeamName).toBeNull();
    expect(result.winnerAnswerPoints).toBeNull();
  });

  it("picks the leaderboard winner by total incl. bonus, but shows only that team's answer points", async () => {
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

    const [result] = await statsService.listPlayedSessions();

    expect(result.teamCount).toBe(2);
    expect(result.winnerTeamName).toBe('Team B');
    expect(result.winnerAnswerPoints).toBe(3);
  });

  it('orders sessions by playedAt (createdAt) descending', async () => {
    const { quiz } = await createQuiz('Quiz E', [[1]]);
    const older = await createSession(quiz, 'OLDER1', 'ended');
    await em
      .getConnection()
      .execute('update game_sessions set created_at = ? where id = ?', [
        new Date('2020-01-01'),
        older.id,
      ]);
    const newer = await createSession(quiz, 'NEWER1', 'ended');

    const result = await statsService.listPlayedSessions();

    expect(result.map((row) => row.gameSessionId)).toEqual([
      newer.id,
      older.id,
    ]);
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
  });
});
