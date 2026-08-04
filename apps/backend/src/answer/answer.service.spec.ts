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
import { AnswerRepository } from '@/db/repositories/answer.repository';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { TeamRepository } from '@/db/repositories/team.repository';
import { AnswerService } from '@/answer/answer.service';

describe('AnswerService (Postgres integration)', () => {
  let container: StartedPostgreSqlContainer;
  let orm: MikroORM;
  let em: EntityManager;
  let answerService: AnswerService;
  let session: GameSession;
  let question: Question;
  let round: Round;

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
    answerService = new AnswerService(
      em.getRepository<Answer, AnswerRepository>(Answer),
      em.getRepository<Team, TeamRepository>(Team),
      em.getRepository<GameSessionTeam, GameSessionTeamRepository>(
        GameSessionTeam,
      ),
    );
    const quiz = em.create(Quiz, { title: 'Answer Test Quiz' });
    round = em.create(Round, { quiz, title: 'Round 1', orderIndex: 0 });
    question = em.create(Question, {
      round,
      orderIndex: 0,
      type: 'free_text',
      prompt: 'Name a fruit',
      answer: 'Apple',
      points: 1,
    });
    session = em.create(GameSession, { quiz, joinCode: 'ABCDEF' });
    await em.flush();
  });

  afterEach(async () => {
    await em
      .getConnection()
      .execute(
        'TRUNCATE answers, bonus_awards, game_session_teams, teams, game_sessions, questions, rounds, quizzes CASCADE',
      );
  });

  async function insertTeam(name: string, token: string): Promise<Team> {
    const team = em.create(Team, { name, token, code: `code-${token}` });
    em.create(GameSessionTeam, { gameSession: session, team });
    await em.flush();
    return team;
  }

  it('creates a new ungraded answer for a team', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');

    const result = await answerService.submit(
      session.id,
      question.id,
      team.id,
      'Banana',
    );

    expect(result.teamId).toBe(team.id);
    expect(result.teamName).toBe('The Quizzards');
    expect(result.value).toBe('Banana');
  });

  it('overwrites the previous answer for the same team and question (last-write-wins)', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');

    await answerService.submit(session.id, question.id, team.id, 'Banana');
    await answerService.submit(session.id, question.id, team.id, 'Apple');

    const answers = await answerService.listForQuestion(
      session.id,
      question.id,
    );
    expect(answers).toHaveLength(1);
    expect(answers[0].value).toBe('Apple');
  });

  it('does not disturb another team answering the same question', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');

    await answerService.submit(session.id, question.id, teamA.id, 'Banana');
    await answerService.submit(session.id, question.id, teamB.id, 'Mango');

    const answers = await answerService.listForQuestion(
      session.id,
      question.id,
    );
    expect(answers).toHaveLength(2);
    expect(answers.find((a) => a.teamId === teamA.id)?.value).toBe('Banana');
    expect(answers.find((a) => a.teamId === teamB.id)?.value).toBe('Mango');
  });

  it('lists a team own answers keyed by question so a reconnect can restore them', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');
    const other = await insertTeam('Team B', 'token-b');
    const question2 = em.create(Question, {
      round,
      orderIndex: 1,
      type: 'free_text',
      prompt: 'Name a vegetable',
      answer: 'Carrot',
      points: 1,
    });
    await em.flush();

    await answerService.submit(session.id, question.id, team.id, 'Banana');
    await answerService.submit(session.id, question2.id, team.id, 'Carrot');
    await answerService.submit(session.id, question.id, other.id, 'Apple');

    const answers = await answerService.listForTeam(session.id, team.id);

    expect(answers).toHaveLength(2);
    expect(answers).toEqual(
      expect.arrayContaining([
        { questionId: question.id, value: 'Banana' },
        { questionId: question2.id, value: 'Carrot' },
      ]),
    );
  });

  it('returns an empty list for a team that has not answered anything', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');

    const answers = await answerService.listForTeam(session.id, team.id);

    expect(answers).toEqual([]);
  });

  it('lists answers with zero points and a null gradedAt before grading', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');
    await answerService.submit(session.id, question.id, team.id, 'Banana');

    const [answer] = await answerService.listForQuestion(
      session.id,
      question.id,
    );
    expect(answer.pointsAwarded).toBe(0);
    expect(answer.gradedAt).toBeNull();
  });

  it('grades an answer, returning the questionId it belongs to', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');
    const submitted = await answerService.submit(
      session.id,
      question.id,
      team.id,
      'Banana',
    );

    const graded = await answerService.grade(submitted.answerId, 2);
    expect(graded.questionId).toBe(question.id);

    const [answer] = await answerService.listForQuestion(
      session.id,
      question.id,
    );
    expect(answer.pointsAwarded).toBe(2);
    expect(answer.gradedAt).not.toBeNull();
  });

  it('grades an answer with half points', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');
    const submitted = await answerService.submit(
      session.id,
      question.id,
      team.id,
      'Banana',
    );

    await answerService.grade(submitted.answerId, 0.5);

    const [answer] = await answerService.listForQuestion(
      session.id,
      question.id,
    );
    expect(answer.pointsAwarded).toBe(0.5);
  });

  it('computes a leaderboard summing graded points per team, sorted descending', async () => {
    const question2 = em.create(Question, {
      round,
      orderIndex: 1,
      type: 'free_text',
      prompt: 'Name a vegetable',
      answer: 'Carrot',
      points: 1,
    });
    await em.flush();

    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');

    const answerA1 = await answerService.submit(
      session.id,
      question.id,
      teamA.id,
      'Banana',
    );
    const answerA2 = await answerService.submit(
      session.id,
      question2.id,
      teamA.id,
      'Carrot',
    );
    const answerB1 = await answerService.submit(
      session.id,
      question.id,
      teamB.id,
      'Mango',
    );

    await answerService.grade(answerA1.answerId, 2);
    await answerService.grade(answerA2.answerId, 0.5);
    await answerService.grade(answerB1.answerId, 1);

    const leaderboard = await answerService.computeLeaderboard(session.id);

    expect(leaderboard).toEqual([
      {
        teamId: teamA.id,
        teamName: 'Team A',
        totalPoints: 2.5,
        bonusPoints: 0,
      },
      { teamId: teamB.id, teamName: 'Team B', totalPoints: 1, bonusPoints: 0 },
    ]);
  });

  it('treats ungraded answers as zero points in the leaderboard', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');
    await answerService.submit(session.id, question.id, team.id, 'Banana');

    const leaderboard = await answerService.computeLeaderboard(session.id);
    expect(leaderboard).toEqual([
      {
        teamId: team.id,
        teamName: 'The Quizzards',
        totalPoints: 0,
        bonusPoints: 0,
      },
    ]);
  });

  it('folds bonus awards into the leaderboard total and reports them separately', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');

    const answerA1 = await answerService.submit(
      session.id,
      question.id,
      teamA.id,
      'Banana',
    );
    await answerService.grade(answerA1.answerId, 2);

    em.create(BonusAward, {
      gameSession: session,
      team: teamA,
      category: 'shot',
      points: 1,
    });
    em.create(BonusAward, {
      gameSession: session,
      team: teamA,
      category: 'custom',
      reason: 'Best team name',
      points: 3,
    });
    em.create(BonusAward, {
      gameSession: session,
      team: teamB,
      category: 'selfie',
      points: 1,
    });
    await em.flush();

    const leaderboard = await answerService.computeLeaderboard(session.id);

    expect(leaderboard).toEqual([
      { teamId: teamA.id, teamName: 'Team A', totalPoints: 6, bonusPoints: 4 },
      { teamId: teamB.id, teamName: 'Team B', totalPoints: 1, bonusPoints: 1 },
    ]);
  });

  it('subtracts a negative bonus (penalty) from the leaderboard total', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');

    const answerA1 = await answerService.submit(
      session.id,
      question.id,
      teamA.id,
      'Banana',
    );
    await answerService.grade(answerA1.answerId, 5);
    const answerB1 = await answerService.submit(
      session.id,
      question.id,
      teamB.id,
      'Mango',
    );
    await answerService.grade(answerB1.answerId, 1);

    em.create(BonusAward, {
      gameSession: session,
      team: teamA,
      category: 'custom',
      reason: 'Late arrival',
      points: -4,
    });
    await em.flush();

    const leaderboard = await answerService.computeLeaderboard(session.id);

    expect(leaderboard).toEqual([
      { teamId: teamA.id, teamName: 'Team A', totalPoints: 1, bonusPoints: -4 },
      { teamId: teamB.id, teamName: 'Team B', totalPoints: 1, bonusPoints: 0 },
    ]);
  });
});
