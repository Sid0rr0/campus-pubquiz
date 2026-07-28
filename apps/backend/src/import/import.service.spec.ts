import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import { Client } from 'pg';
import * as schema from '@/db/schema';
import { SeedService } from '@/db/seed.service';
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
  activeQuizId: string;
  reloadActiveQuiz: jest.Mock;
}

function makeGameStateStub(overrides: Partial<GameStateStub> = {}): {
  stub: GameStateStub;
  asService: GameStateService;
} {
  const stub: GameStateStub = {
    status: 'lobby',
    activeQuizId: 'unrelated-quiz-id',
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
  let client: Client;
  let db: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    client = new Client({ connectionString: container.getConnectionUri() });
    await client.connect();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: './drizzle' });
  }, 60_000);

  afterAll(async () => {
    await client.end();
    await container.stop();
  });

  afterEach(async () => {
    await client.query(
      'TRUNCATE answers, teams, game_sessions, questions, rounds, quizzes CASCADE',
    );
  });

  function makeService(overrides: Partial<GameStateStub> = {}) {
    const { stub, asService } = makeGameStateStub(overrides);
    return { importService: new ImportService(db, asService), stub };
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
      const quizzes = await db.select().from(schema.quizzes);
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

      const roundRows = await db
        .select()
        .from(schema.rounds)
        .where(eq(schema.rounds.quizId, result.quizId))
        .orderBy(schema.rounds.orderIndex);
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

      const questionRows = await db
        .select()
        .from(schema.questions)
        .where(eq(schema.questions.roundId, roundRows[1].id));
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
      const before = await db
        .select()
        .from(schema.questions)
        .orderBy(schema.questions.orderIndex);

      const second = await importService.confirm(VALID_CSV, 'Trivia Night');

      expect(second.quizId).toBe(first.quizId);
      const quizzes = await db.select().from(schema.quizzes);
      expect(quizzes).toHaveLength(1);
      const after = await db
        .select()
        .from(schema.questions)
        .orderBy(schema.questions.orderIndex);
      expect(after.map((question) => question.id).sort()).toEqual(
        before.map((question) => question.id).sort(),
      );
    });

    it('updates edited questions and deletes rounds and questions removed from the sheet', async () => {
      const { importService } = makeService();
      const first = await importService.confirm(VALID_CSV, 'Trivia Night');
      const [historyRound] = await db
        .select()
        .from(schema.rounds)
        .where(eq(schema.rounds.quizId, first.quizId))
        .orderBy(schema.rounds.orderIndex);
      const [keptQuestion] = await db
        .select()
        .from(schema.questions)
        .where(eq(schema.questions.roundId, historyRound.id))
        .orderBy(schema.questions.orderIndex);

      const second = await importService.confirm(EDITED_CSV, 'Trivia Night');

      expect(second.quizId).toBe(first.quizId);
      expect(second.roundCount).toBe(1);
      expect(second.questionCount).toBe(1);

      const roundRows = await db
        .select()
        .from(schema.rounds)
        .where(eq(schema.rounds.quizId, first.quizId));
      expect(roundRows).toHaveLength(1);

      const questionRows = await db
        .select()
        .from(schema.questions)
        .where(eq(schema.questions.roundId, historyRound.id));
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

      const quizzes = await db.select().from(schema.quizzes);
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
      const seedService = new SeedService(db);
      const [session] = await db
        .insert(schema.gameSessions)
        .values({ quizId: result.quizId, joinCode: 'ABC234' })
        .returning();

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
