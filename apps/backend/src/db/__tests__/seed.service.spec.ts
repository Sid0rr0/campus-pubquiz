import type { EntityManager } from '@mikro-orm/postgresql';
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
import { useTestDatabase } from '@/test-db/test-database';

describe('SeedService (Postgres integration)', () => {
  const db = useTestDatabase();
  let em: EntityManager;
  let seedService: SeedService;

  function makeSeedService(scope: EntityManager): SeedService {
    return new SeedService(
      scope.getRepository<Quiz, QuizRepository>(Quiz),
      scope.getRepository<Round, RoundRepository>(Round),
      scope.getRepository<Question, QuestionRepository>(Question),
      scope.getRepository<GameSession, GameSessionRepository>(GameSession),
    );
  }

  /** The demo game a boot creates on an empty database. */
  async function seedFirstGame(service = seedService) {
    const [game] = await service.seedOpenGames();
    return game;
  }

  beforeEach(() => {
    em = db.orm.em.fork();
    seedService = makeSeedService(em);
  });

  it('creates the quiz/rounds/questions/session from the hardcoded fixture on first seed', async () => {
    const result = await seedFirstGame();

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
    const result = await seedFirstGame();

    expect(Number.isInteger(result.quizId)).toBe(true);
    for (const round of result.rounds) {
      expect(Number.isInteger(round.id)).toBe(true);
      for (const question of round.questions) {
        expect(Number.isInteger(question.id)).toBe(true);
      }
    }
  });

  it('is idempotent: seeding twice does not duplicate rows and returns the same ids', async () => {
    const first = await seedFirstGame();
    const second = await seedFirstGame();

    expect(second).toEqual(first);

    const quizzesInDb = await em.find(Quiz, {});
    const sessionsInDb = await em.find(GameSession, {});
    expect(quizzesInDb).toHaveLength(1);
    expect(sessionsInDb).toHaveLength(1);
  });

  it('creates a fresh game session with a new join code for a quiz', async () => {
    const first = await seedFirstGame();

    const session = await seedService.createSession(first.quizId);

    expect(session.gameSessionId).not.toBe(first.gameSessionId);
    expect(session.joinCode).toMatch(/^[A-Z]+-[A-Z]+-[A-Z]+$/);
    expect(session.joinCode).not.toBe(first.joinCode);

    const sessionsInDb = await em.find(GameSession, {});
    expect(sessionsInDb).toHaveLength(2);
  });

  it('persists a trimmed custom name when creating a session with one', async () => {
    const first = await seedFirstGame();

    const session = await seedService.createSession(
      first.quizId,
      undefined,
      '  Week 3 Social  ',
    );

    const row = await em.findOneOrFail(GameSession, {
      id: session.gameSessionId,
    });
    expect(row.name).toBe('Week 3 Social');
  });

  it('stores a null name when none is given, or when it is blank', async () => {
    const first = await seedFirstGame();

    const noName = await seedService.createSession(first.quizId);
    const blankName = await seedService.createSession(
      first.quizId,
      undefined,
      '   ',
    );

    const noNameRow = await em.findOneOrFail(GameSession, {
      id: noName.gameSessionId,
    });
    const blankNameRow = await em.findOneOrFail(GameSession, {
      id: blankName.gameSessionId,
    });
    expect(noNameRow.name).toBeNull();
    expect(blankNameRow.name).toBeNull();
  });

  describe('seedOpenGames', () => {
    it('creates the demo game only when the database has no session at all', async () => {
      const first = await seedService.seedOpenGames();
      expect(first).toHaveLength(1);

      await em.nativeUpdate(
        GameSession,
        { id: first[0].gameSessionId },
        { closedAt: new Date() },
      );

      expect(await seedService.seedOpenGames()).toEqual([]);
      expect(await em.count(GameSession, {})).toBe(1);
    });

    it('resumes every open session after a restart, oldest first, and skips closed ones', async () => {
      const first = await seedFirstGame();
      const second = await seedService.createSession(first.quizId);
      const closed = await seedService.createSession(first.quizId);
      await em.nativeUpdate(
        GameSession,
        { id: closed.gameSessionId },
        { closedAt: new Date() },
      );

      const resumed = await makeSeedService(db.orm.em.fork()).seedOpenGames();

      expect(resumed.map((game) => game.gameSessionId)).toEqual([
        first.gameSessionId,
        second.gameSessionId,
      ]);
    });
  });

  it('preserves question content (prompt, type, options, points) from the fixture', async () => {
    const result = await seedFirstGame();
    const firstQuestion = result.rounds[0].questions[0];
    const fixtureQuestion = HARDCODED_QUIZ.rounds[0].questions[0];

    expect(firstQuestion.prompt).toBe(fixtureQuestion.prompt);
    expect(firstQuestion.type).toBe(fixtureQuestion.type);
    expect(firstQuestion.options).toEqual(fixtureQuestion.options);
    expect(firstQuestion.points).toBe(fixtureQuestion.points);
  });

  it('carries the correct answer on every seeded question, including on a reload from the database', async () => {
    const seeded = await seedFirstGame();
    const fixtureQuestion = HARDCODED_QUIZ.rounds[0].questions[0];
    expect(seeded.rounds[0].questions[0].answer).toBe(fixtureQuestion.answer);

    const reloaded = await seedService.loadGame(
      seeded.quizId,
      seeded.gameSessionId,
      seeded.joinCode,
    );
    expect(reloaded.rounds[0].questions[0].answer).toBe(fixtureQuestion.answer);
  });

  describe('loadQuizRounds', () => {
    async function buildQuiz() {
      const quiz = em.create(Quiz, {
        title: 'Preview quiz',
        mode: 'quickfire',
      });
      const second = em.create(Round, {
        quiz,
        title: 'Second',
        orderIndex: 1,
      });
      const first = em.create(Round, {
        quiz,
        title: 'First',
        orderIndex: 0,
        breakAfter: true,
        category: 'Music',
        author: 'Sam',
        note: 'Say hi',
        showNoteOnScreen: true,
      });
      em.create(Question, {
        round: first,
        orderIndex: 1,
        type: 'multiple_choice',
        prompt: 'Pick one',
        answer: 'B',
        notes: 'Host note',
        payload: { options: ['A', 'B', 'C'] },
        points: 2,
      });
      em.create(Question, {
        round: first,
        orderIndex: 0,
        type: 'free_text',
        prompt: 'Name it',
        answer: 'Paris',
        payload: {
          mediaUrl: 'https://example.com/clip.mp4',
          mediaStartSeconds: 5,
          mediaEndSeconds: 12,
          isVideoHidden: true,
        },
      });
      em.create(Question, {
        round: second,
        orderIndex: 0,
        type: 'free_text',
        prompt: 'Look',
        answer: 'Cat',
        payload: { mediaUrl: 'https://example.com/cat.png' },
      });
      await em.flush();
      return quiz;
    }

    it('loads a quiz in round and question order without a session row', async () => {
      const quiz = await buildQuiz();

      const rounds = await seedService.loadQuizRounds(quiz.id);

      expect(rounds.map((round) => round.title)).toEqual(['First', 'Second']);
      expect(rounds[0].questions.map((q) => q.prompt)).toEqual([
        'Name it',
        'Pick one',
      ]);
      expect(rounds[0]).toMatchObject({
        breakAfter: true,
        category: 'Music',
        author: 'Sam',
        note: 'Say hi',
        showNoteOnScreen: true,
      });
      expect(rounds.map((round) => round.quickfire)).toEqual([true, true]);
      expect(Object.values(rounds[0].questionNotesById ?? {})).toContain(
        'Host note',
      );
      expect(await em.count(GameSession, {})).toBe(0);
    });

    it('leaves every round non-quickfire in a pub quiz', async () => {
      const quiz = await buildQuiz();
      quiz.mode = 'pub';
      await em.flush();

      const rounds = await seedService.loadQuizRounds(quiz.id);

      expect(rounds.map((round) => round.quickfire)).toEqual([false, false]);
    });

    it('holds the quiz exactly as a session on it does', async () => {
      const quiz = await buildQuiz();
      const created = await seedService.createSession(quiz.id);

      const rounds = await seedService.loadQuizRounds(quiz.id);
      const game = await seedService.loadGame(
        quiz.id,
        created.gameSessionId,
        created.joinCode,
      );

      expect(rounds).toEqual(game.rounds);
    });
  });

  describe('settings a stored session plays with', () => {
    async function loadWithStoredSettings(mode: 'pub' | 'quickfire') {
      const first = await seedFirstGame();
      const quiz = await em.findOneOrFail(Quiz, { id: first.quizId });
      quiz.mode = mode;
      const created = await seedService.createSession(first.quizId, {
        ...first.settings,
        jokersEnabled: true,
        powerUpsEnabled: true,
        startingCoins: 5,
      });
      await em.flush();
      return seedService.loadGame(
        first.quizId,
        created.gameSessionId,
        created.joinCode,
      );
    }

    it('switches jokers, power-ups and coins off for a quickfire quiz', async () => {
      const game = await loadWithStoredSettings('quickfire');

      expect(game.settings).toMatchObject({
        jokersEnabled: false,
        powerUpsEnabled: false,
        startingCoins: 0,
      });
    });

    it('loads a pub quiz row unchanged', async () => {
      const game = await loadWithStoredSettings('pub');

      expect(game.settings).toMatchObject({
        jokersEnabled: true,
        powerUpsEnabled: true,
        startingCoins: 5,
      });
    });
  });

  describe('summary facts on the loaded game', () => {
    it('carries the quiz title, custom name and session start time', async () => {
      const first = await seedFirstGame();
      const named = await seedService.createSession(
        first.quizId,
        undefined,
        'Week 3 Social',
      );

      const game = await seedService.loadGame(
        first.quizId,
        named.gameSessionId,
        named.joinCode,
      );

      const row = await em.findOneOrFail(GameSession, {
        id: named.gameSessionId,
      });
      expect(game.quizTitle).toBe(HARDCODED_QUIZ.title);
      expect(game.customName).toBe('Week 3 Social');
      expect(game.startedAt).toEqual(row.createdAt);
    });

    it('has a null custom name when none was set', async () => {
      const first = await seedFirstGame();

      expect(first.customName).toBeNull();
    });

    it('gives the same facts whether seed created the boot game or resumed it', async () => {
      const created = await seedFirstGame();

      const resumed = await seedFirstGame(makeSeedService(db.orm.em.fork()));

      expect(resumed.quizTitle).toBe(created.quizTitle);
      expect(resumed.customName).toBe(created.customName);
      expect(resumed.startedAt).toEqual(created.startedAt);
    });
  });
});
