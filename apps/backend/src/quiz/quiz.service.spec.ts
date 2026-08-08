import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { MikroORM, type EntityManager } from '@mikro-orm/postgresql';
import type { ImportRoundPreview } from '@campus-pubquiz/types';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { QuestionRepository } from '@/db/repositories/question.repository';
import { QuizRepository } from '@/db/repositories/quiz.repository';
import { RoundRepository } from '@/db/repositories/round.repository';
import {
  QuizDraftInvalidError,
  QuizNotFoundError,
  QuizService,
} from '@/quiz/quiz.service';

describe('QuizService (Postgres integration)', () => {
  let container: StartedPostgreSqlContainer;
  let orm: MikroORM;
  let em: EntityManager;
  let quizService: QuizService;

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
    quizService = new QuizService(
      em.getRepository<Quiz, QuizRepository>(Quiz),
      em.getRepository<Round, RoundRepository>(Round),
      em.getRepository<Question, QuestionRepository>(Question),
    );
  });

  afterEach(async () => {
    await em
      .getConnection()
      .execute(
        'TRUNCATE answers, teams, game_sessions, questions, rounds, quizzes CASCADE',
      );
  });

  async function insertQuiz(title: string): Promise<Quiz> {
    const quiz = em.create(Quiz, { title });
    await em.flush();
    return quiz;
  }

  async function insertRound(
    quiz: Quiz,
    title: string,
    orderIndex: number,
    breakAfter = false,
  ): Promise<Round> {
    const round = em.create(Round, { quiz, title, orderIndex, breakAfter });
    await em.flush();
    return round;
  }

  async function insertQuestion(
    round: Round,
    prompt: string,
    orderIndex: number,
    payload: { options?: string[]; answer?: string } = {},
  ): Promise<Question> {
    const { answer, ...restPayload } = payload;
    const question = em.create(Question, {
      round,
      orderIndex,
      type: payload.options ? 'multiple_choice' : 'free_text',
      prompt,
      answer: answer || 'unknown',
      payload: restPayload,
      points: 1,
    });
    await em.flush();
    return question;
  }

  it('lists every quiz with its id, title, and empty rounds when it has none', async () => {
    const quizA = await insertQuiz('Campus Pub Quiz Night');
    const quizB = await insertQuiz('Imported Quiz');

    const quizzes = await quizService.list();

    expect(quizzes).toHaveLength(2);
    expect(quizzes).toEqual(
      expect.arrayContaining([
        { id: quizA.id, title: 'Campus Pub Quiz Night', rounds: [] },
        { id: quizB.id, title: 'Imported Quiz', rounds: [] },
      ]),
    );
  });

  it("includes each quiz's rounds and questions in order", async () => {
    const quiz = await insertQuiz('Campus Pub Quiz Night');
    const round1 = await insertRound(quiz, 'Round 1', 0, true);
    await insertRound(quiz, 'Round 2', 1);
    const q1 = await insertQuestion(round1, 'Name a fruit', 0, {
      answer: 'Banana',
    });
    const q2 = await insertQuestion(round1, 'Name a vegetable', 1, {
      answer: 'Carrot',
    });

    const [listed] = await quizService.list();

    expect(listed.rounds).toEqual([
      {
        title: 'Round 1',
        breakAfter: true,
        questions: [
          {
            id: q1.id,
            type: 'free_text',
            prompt: 'Name a fruit',
            answer: 'Banana',
          },
          {
            id: q2.id,
            type: 'free_text',
            prompt: 'Name a vegetable',
            answer: 'Carrot',
          },
        ],
      },
      { title: 'Round 2', breakAfter: false, questions: [] },
    ]);
  });

  it("includes each question's options and correct answer", async () => {
    const quiz = await insertQuiz('Campus Pub Quiz Night');
    const round = await insertRound(quiz, 'Round 1', 0);
    const question = await insertQuestion(round, 'Capital of France?', 0, {
      options: ['Paris', 'London', 'Berlin'],
      answer: 'Paris',
    });

    const [listed] = await quizService.list();

    expect(listed.rounds[0].questions).toEqual([
      {
        id: question.id,
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        options: ['Paris', 'London', 'Berlin'],
        answer: 'Paris',
      },
    ]);
  });

  it('returns an empty list when no quizzes exist', async () => {
    await expect(quizService.list()).resolves.toEqual([]);
  });

  describe('findTitles', () => {
    it('maps requested quiz ids to their titles', async () => {
      const quizA = await insertQuiz('Campus Pub Quiz Night');
      const quizB = await insertQuiz('Imported Quiz');

      const titles = await quizService.findTitles([quizA.id, quizB.id]);

      expect(titles.get(quizA.id)).toBe('Campus Pub Quiz Night');
      expect(titles.get(quizB.id)).toBe('Imported Quiz');
    });

    it('omits ids that do not exist rather than throwing', async () => {
      const quizA = await insertQuiz('Campus Pub Quiz Night');

      const titles = await quizService.findTitles([quizA.id, 999_999]);

      expect(titles.size).toBe(1);
      expect(titles.has(999_999)).toBe(false);
    });

    it('returns an empty map without querying for an empty id list', async () => {
      const titles = await quizService.findTitles([]);

      expect(titles.size).toBe(0);
    });
  });

  const VALID_ROUND: ImportRoundPreview = {
    title: 'History',
    breakAfter: true,
    questions: [
      {
        type: 'free_text',
        prompt: 'Largest planet?',
        answer: 'Jupiter',
        points: 2,
      },
      {
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        answer: 'Paris',
        points: 3,
        options: ['Paris', 'London'],
      },
    ],
  };

  describe('findDraftById', () => {
    it('returns null when the quiz does not exist', async () => {
      await expect(quizService.findDraftById(999_999)).resolves.toBeNull();
    });

    it('returns the full editable draft, including notes and media urls', async () => {
      const created = await quizService.create('Trivia Night', [
        {
          title: 'Music',
          breakAfter: true,
          questions: [
            {
              type: 'audio',
              prompt: 'Name this song.',
              answer: 'Bohemian Rhapsody',
              points: 2,
              notes: 'Play only the chorus',
              mediaUrl: 'https://example.com/song.mp3',
              answerMediaUrl: 'https://example.com/cover.jpg',
            },
          ],
        },
      ]);

      const draft = await quizService.findDraftById(created.quizId);

      expect(draft).toEqual({
        id: created.quizId,
        title: 'Trivia Night',
        rounds: [
          {
            title: 'Music',
            breakAfter: true,
            questions: [
              {
                type: 'audio',
                prompt: 'Name this song.',
                answer: 'Bohemian Rhapsody',
                points: 2,
                notes: 'Play only the chorus',
                mediaUrl: 'https://example.com/song.mp3',
                answerMediaUrl: 'https://example.com/cover.jpg',
              },
            ],
          },
        ],
      });
    });
  });

  describe('create', () => {
    it('creates a new quiz with its rounds and questions', async () => {
      const result = await quizService.create('Trivia Night', [VALID_ROUND]);

      expect(result.roundCount).toBe(1);
      expect(result.questionCount).toBe(2);
      const quiz = await em.findOneOrFail(Quiz, { id: result.quizId });
      expect(quiz.title).toBe('Trivia Night');
    });

    it('rejects an invalid draft without writing anything', async () => {
      await expect(
        quizService.create('Trivia Night', [{ ...VALID_ROUND, questions: [] }]),
      ).rejects.toThrow(QuizDraftInvalidError);

      await expect(em.find(Quiz, {})).resolves.toEqual([]);
    });

    it('derives a YouTube clip range from notes into the question payload', async () => {
      const result = await quizService.create('Trivia Night', [
        {
          title: 'Music Videos',
          breakAfter: true,
          questions: [
            {
              type: 'picture',
              prompt: 'Name this music video.',
              answer: 'Never Gonna Give You Up',
              points: 3,
              notes: '{start: "1:22", end: "2:20"}',
              mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
            },
          ],
        },
      ]);

      const [question] = await em.find(Question, {
        round: { quiz: result.quizId },
      });
      expect(question.payload).toMatchObject({
        mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
        mediaStartSeconds: 82,
        mediaEndSeconds: 140,
      });
    });

    it('does not derive a clip range when notes has no clip syntax', async () => {
      const result = await quizService.create('Trivia Night', [
        {
          title: 'Music Videos',
          breakAfter: true,
          questions: [
            {
              type: 'picture',
              prompt: 'Name this music video.',
              answer: 'Never Gonna Give You Up',
              points: 3,
              notes: 'Play the whole thing',
              mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
            },
          ],
        },
      ]);

      const [question] = await em.find(Question, {
        round: { quiz: result.quizId },
      });
      expect(question.payload).not.toHaveProperty('mediaStartSeconds');
      expect(question.payload).not.toHaveProperty('mediaEndSeconds');
    });
  });

  describe('update', () => {
    it('renames the quiz and syncs its rounds/questions', async () => {
      const created = await quizService.create('Trivia Night', [VALID_ROUND]);

      const result = await quizService.update(
        created.quizId,
        'Trivia Night 2',
        [
          {
            title: 'History',
            breakAfter: true,
            questions: [
              {
                type: 'free_text',
                prompt: 'Largest planet?',
                answer: 'Jupiter',
                points: 5,
              },
            ],
          },
        ],
      );

      expect(result.questionCount).toBe(1);
      const quiz = await em.findOneOrFail(Quiz, { id: created.quizId });
      expect(quiz.title).toBe('Trivia Night 2');
      const questions = await em.find(Question, {});
      expect(questions).toHaveLength(1);
      expect(questions[0].points).toBe(5);
    });

    it('rejects updating a quiz that does not exist', async () => {
      await expect(
        quizService.update(999_999, 'Trivia Night', [VALID_ROUND]),
      ).rejects.toThrow(QuizNotFoundError);
    });

    it('rejects an invalid draft without writing anything', async () => {
      const created = await quizService.create('Trivia Night', [VALID_ROUND]);

      await expect(
        quizService.update(created.quizId, '  ', [VALID_ROUND]),
      ).rejects.toThrow(QuizDraftInvalidError);

      const quiz = await em.findOneOrFail(Quiz, { id: created.quizId });
      expect(quiz.title).toBe('Trivia Night');
    });
  });
});
