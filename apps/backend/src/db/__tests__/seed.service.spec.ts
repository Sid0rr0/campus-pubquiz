import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { MikroORM, type EntityManager } from '@mikro-orm/postgresql';
import { HARDCODED_QUIZ } from '@/game/fixtures/hardcoded-quiz.fixture';
import { GameSession } from '@/db/entities/game-session.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';
import { QuestionRepository } from '@/db/repositories/question.repository';
import { QuizRepository } from '@/db/repositories/quiz.repository';
import { RoundRepository } from '@/db/repositories/round.repository';
import { SeedService } from '@/db/seed.service';

describe('SeedService (Postgres integration)', () => {
  let container: StartedPostgreSqlContainer;
  let orm: MikroORM;
  let em: EntityManager;
  let seedService: SeedService;

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

  function makeSeedService(scope: EntityManager): SeedService {
    return new SeedService(
      scope.getRepository<Quiz, QuizRepository>(Quiz),
      scope.getRepository<Round, RoundRepository>(Round),
      scope.getRepository<Question, QuestionRepository>(Question),
      scope.getRepository<GameSession, GameSessionRepository>(GameSession),
    );
  }

  beforeEach(() => {
    em = orm.em.fork();
    seedService = makeSeedService(em);
  });

  afterEach(async () => {
    await em
      .getConnection()
      .execute(
        'TRUNCATE answers, teams, game_sessions, questions, rounds, quizzes CASCADE',
      );
  });

  it('creates the quiz/rounds/questions/session from the hardcoded fixture on first seed', async () => {
    const result = await seedService.seed();

    expect(result.rounds).toHaveLength(HARDCODED_QUIZ.rounds.length);
    result.rounds.forEach((round, roundIndex) => {
      expect(round.questions).toHaveLength(
        HARDCODED_QUIZ.rounds[roundIndex].questions.length,
      );
      expect(round.breakAfter).toBe(
        HARDCODED_QUIZ.rounds[roundIndex].breakAfter,
      );
    });
    expect(result.joinCode).toMatch(/^[A-Z]+-[A-Z]+-[A-Z]+$/);

    const quizzesInDb = await em.find(Quiz, {});
    expect(quizzesInDb).toHaveLength(1);
  });

  it('assigns sequential integer ids to every seeded round and question', async () => {
    const result = await seedService.seed();

    expect(Number.isInteger(result.quizId)).toBe(true);
    for (const round of result.rounds) {
      expect(Number.isInteger(round.id)).toBe(true);
      for (const question of round.questions) {
        expect(Number.isInteger(question.id)).toBe(true);
      }
    }
  });

  it('is idempotent: seeding twice does not duplicate rows and returns the same ids', async () => {
    const first = await seedService.seed();
    const second = await seedService.seed();

    expect(second).toEqual(first);

    const quizzesInDb = await em.find(Quiz, {});
    const sessionsInDb = await em.find(GameSession, {});
    expect(quizzesInDb).toHaveLength(1);
    expect(sessionsInDb).toHaveLength(1);
  });

  it('creates a fresh game session with a new join code for a quiz', async () => {
    const first = await seedService.seed();

    const session = await seedService.createSession(first.quizId);

    expect(session.gameSessionId).not.toBe(first.gameSessionId);
    expect(session.joinCode).toMatch(/^[A-Z]+-[A-Z]+-[A-Z]+$/);
    expect(session.joinCode).not.toBe(first.joinCode);

    const sessionsInDb = await em.find(GameSession, {});
    expect(sessionsInDb).toHaveLength(2);
  });

  it('resumes the most recently created game session on seed after a restart', async () => {
    const first = await seedService.seed();
    const newerSession = em.create(GameSession, {
      quiz: first.quizId,
      joinCode: 'ZZZZZZ',
      createdAt: new Date(Date.now() + 60_000),
    });
    await em.flush();

    const resumed = await makeSeedService(orm.em.fork()).seed();

    expect(resumed.gameSessionId).toBe(newerSession.id);
    expect(resumed.joinCode).toBe('ZZZZZZ');
  });

  it('preserves question content (prompt, type, options, points) from the fixture', async () => {
    const result = await seedService.seed();
    const firstQuestion = result.rounds[0].questions[0];
    const fixtureQuestion = HARDCODED_QUIZ.rounds[0].questions[0];

    expect(firstQuestion.prompt).toBe(fixtureQuestion.prompt);
    expect(firstQuestion.type).toBe(fixtureQuestion.type);
    expect(firstQuestion.options).toEqual(fixtureQuestion.options);
    expect(firstQuestion.points).toBe(fixtureQuestion.points);
  });

  it('carries the correct answer on every seeded question, including on a reload from the database', async () => {
    const seeded = await seedService.seed();
    const fixtureQuestion = HARDCODED_QUIZ.rounds[0].questions[0];
    expect(seeded.rounds[0].questions[0].answer).toBe(fixtureQuestion.answer);

    const reloaded = await seedService.loadGame(
      seeded.quizId,
      seeded.gameSessionId,
      seeded.joinCode,
    );
    expect(reloaded.rounds[0].questions[0].answer).toBe(fixtureQuestion.answer);
  });
});
