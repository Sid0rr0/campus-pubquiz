import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { MikroORM, type EntityManager } from '@mikro-orm/postgresql';
import { SeedService } from '@/db/seed.service';
import { GameSession } from '@/db/entities/game-session.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';
import { QuestionRepository } from '@/db/repositories/question.repository';
import { QuizRepository } from '@/db/repositories/quiz.repository';
import { RoundRepository } from '@/db/repositories/round.repository';
import type { GameStateService } from '@/game/game-state.service';
import {
  ImportBlockedError,
  ImportLockedError,
  ImportService,
} from '@/import/import.service';

const HEADER =
  'round,type,question,options,answer,points,media_url,notes,break_after';

const VALID_CSV = [
  HEADER,
  'History,free_text,Largest planet?,,Jupiter,2,,,0',
  'History,multiple_choice,Capital of France?,Paris|London,Paris,3,,,0',
  'Music,audio,Name this song.,,Bohemian Rhapsody,2,https://example.com/song.mp3,,1',
].join('\n');

const EDITED_CSV = [
  HEADER,
  'History,free_text,Largest planet in our solar system?,,Jupiter,2,,,1',
].join('\n');

const BROKEN_CSV = [HEADER, 'History,karaoke,Sing it!,,,,,,0'].join('\n');

interface GameStateStub {
  status: string;
  activeQuizId: number;
  reloadActiveQuiz: jest.Mock;
}

function makeGameStateStub(overrides: Partial<GameStateStub> = {}): {
  stub: GameStateStub;
  asService: GameStateService;
} {
  const stub: GameStateStub = {
    status: 'lobby',
    activeQuizId: -1,
    reloadActiveQuiz: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const asService = {
    getSnapshot: () => ({ progress: { status: stub.status } }),
    getActiveQuizId: () => stub.activeQuizId,
    reloadActiveQuiz: stub.reloadActiveQuiz,
  } as unknown as GameStateService;
  return { stub, asService };
}

describe('ImportService (Postgres integration)', () => {
  let container: StartedPostgreSqlContainer;
  let orm: MikroORM;
  let em: EntityManager;

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
  });

  afterEach(async () => {
    await em
      .getConnection()
      .execute(
        'TRUNCATE answers, teams, game_sessions, questions, rounds, quizzes CASCADE',
      );
  });

  function makeService(overrides: Partial<GameStateStub> = {}) {
    const { stub, asService } = makeGameStateStub(overrides);
    const importService = new ImportService(
      em.getRepository<Quiz, QuizRepository>(Quiz),
      em.getRepository<Round, RoundRepository>(Round),
      em.getRepository<Question, QuestionRepository>(Question),
      asService,
    );
    return { importService, stub };
  }

  describe('preview', () => {
    it('parses and validates the csv without writing anything', async () => {
      // Arrange
      const { importService } = makeService();

      // Act
      const preview = importService.preview(VALID_CSV, 'Trivia Night');

      // Assert
      expect(preview.isImportable).toBe(true);
      expect(preview.quizTitle).toBe('Trivia Night');
      expect(preview.rounds.map((round) => round.title)).toEqual([
        'History',
        'Music',
      ]);
      const quizzes = await em.find(Quiz, {});
      expect(quizzes).toHaveLength(0);
    });

    it('reports a file-level problem as an issue instead of throwing', () => {
      const { importService } = makeService();

      const preview = importService.preview('not,a,quiz\nsheet,at,all');

      expect(preview.isImportable).toBe(false);
      expect(preview.issues).toHaveLength(1);
      expect(preview.issues[0]).toMatchObject({ rowNumber: 1, field: 'file' });
    });

    it('defaults the quiz title when none is provided', () => {
      const { importService } = makeService();

      const preview = importService.preview(VALID_CSV);

      expect(preview.quizTitle).toBe('Imported Quiz');
    });
  });

  describe('confirm', () => {
    it('creates the quiz with rounds and questions in sheet order', async () => {
      // Arrange
      const { importService } = makeService();

      // Act
      const result = await importService.confirm(VALID_CSV, 'Trivia Night');

      // Assert
      expect(result.roundCount).toBe(2);
      expect(result.questionCount).toBe(3);

      const roundRows = await em.find(
        Round,
        { quiz: result.quizId },
        { orderBy: { orderIndex: 'asc' } },
      );
      expect(roundRows.map((round) => round.title)).toEqual([
        'History',
        'Music',
      ]);
      expect(
        roundRows.find((round) => round.title === 'History')?.breakAfter,
      ).toBe(false);
      expect(
        roundRows.find((round) => round.title === 'Music')?.breakAfter,
      ).toBe(true);

      const questionRows = await em.find(Question, {
        round: roundRows[1].id,
      });
      expect(questionRows).toHaveLength(1);
      expect(questionRows[0].type).toBe('audio');
      expect(questionRows[0].points).toBe(2);
      expect(questionRows[0].answer).toBe('Bohemian Rhapsody');
      expect(questionRows[0].payload).toEqual({
        mediaUrl: 'https://example.com/song.mp3',
      });
    });

    it('re-imports idempotently, updating questions in place with stable ids', async () => {
      const { importService } = makeService();
      const first = await importService.confirm(VALID_CSV, 'Trivia Night');
      const before = await em.find(
        Question,
        {},
        { orderBy: { orderIndex: 'asc' } },
      );

      const second = await importService.confirm(VALID_CSV, 'Trivia Night');

      expect(second.quizId).toBe(first.quizId);
      const quizzes = await em.find(Quiz, {});
      expect(quizzes).toHaveLength(1);
      const after = await em.find(
        Question,
        {},
        { orderBy: { orderIndex: 'asc' } },
      );
      expect(after.map((question) => question.id).sort()).toEqual(
        before.map((question) => question.id).sort(),
      );
    });

    it('updates edited questions and deletes rounds and questions removed from the sheet', async () => {
      const { importService } = makeService();
      const first = await importService.confirm(VALID_CSV, 'Trivia Night');
      const [historyRound] = await em.find(
        Round,
        { quiz: first.quizId },
        { orderBy: { orderIndex: 'asc' } },
      );
      const [keptQuestion] = await em.find(
        Question,
        { round: historyRound.id },
        { orderBy: { orderIndex: 'asc' } },
      );

      const second = await importService.confirm(EDITED_CSV, 'Trivia Night');

      expect(second.quizId).toBe(first.quizId);
      expect(second.roundCount).toBe(1);
      expect(second.questionCount).toBe(1);

      const roundRows = await em.find(Round, { quiz: first.quizId });
      expect(roundRows).toHaveLength(1);

      const questionRows = await em.find(Question, {
        round: historyRound.id,
      });
      expect(questionRows).toHaveLength(1);
      expect(questionRows[0].id).toBe(keptQuestion.id);
      expect(questionRows[0].prompt).toBe(
        'Largest planet in our solar system?',
      );
    });

    it('rejects a csv with validation issues without writing anything', async () => {
      const { importService } = makeService();

      await expect(
        importService.confirm(BROKEN_CSV, 'Trivia Night'),
      ).rejects.toThrow(ImportBlockedError);

      const quizzes = await em.find(Quiz, {});
      expect(quizzes).toHaveLength(0);
    });

    it('rejects importing while a quiz is running', async () => {
      const { importService } = makeService({ status: 'question_open' });

      await expect(
        importService.confirm(VALID_CSV, 'Trivia Night'),
      ).rejects.toThrow(ImportLockedError);
    });

    it('allows importing after the quiz has ended', async () => {
      const { importService } = makeService({ status: 'ended' });

      const result = await importService.confirm(VALID_CSV, 'Trivia Night');

      expect(result.questionCount).toBe(3);
    });

    it('reloads the in-memory game when the imported quiz is the active one', async () => {
      const { importService, stub } = makeService();
      const first = await importService.confirm(VALID_CSV, 'Trivia Night');
      expect(stub.reloadActiveQuiz).not.toHaveBeenCalled();

      stub.activeQuizId = first.quizId;
      await importService.confirm(VALID_CSV, 'Trivia Night');

      expect(stub.reloadActiveQuiz).toHaveBeenCalledTimes(1);
    });

    it("carries each question's correct answer through the loaded game, alongside its safe payload fields", async () => {
      // SeedService is the internal layer that must know the answer (so
      // GameStateService can reveal it after grading); the answer-free
      // projection sent to clients is GameStateService's responsibility,
      // covered separately in game-state.service.spec.ts.
      const { importService } = makeService();
      const result = await importService.confirm(VALID_CSV, 'Trivia Night');
      const seedService = new SeedService(
        em.getRepository<Quiz, QuizRepository>(Quiz),
        em.getRepository<Round, RoundRepository>(Round),
        em.getRepository<Question, QuestionRepository>(Question),
        em.getRepository<GameSession, GameSessionRepository>(GameSession),
      );
      const session = em.create(GameSession, {
        quiz: result.quizId,
        joinCode: 'ABC234',
      });
      await em.flush();

      const game = await seedService.loadGame(
        result.quizId,
        session.id,
        session.joinCode,
      );

      const questions = game.rounds.flatMap((round) => round.questions);
      expect(questions).toHaveLength(3);
      expect(questions.map((question) => question.answer)).toEqual(
        expect.arrayContaining(['Jupiter', 'Paris', 'Bohemian Rhapsody']),
      );
      const audioQuestion = questions.find(
        (question) => question.type === 'audio',
      );
      expect(audioQuestion?.mediaUrl).toBe('https://example.com/song.mp3');
    });
  });
});
