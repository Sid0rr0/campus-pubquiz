import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { MikroORM, type EntityManager } from '@mikro-orm/postgresql';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { QuizRepository } from '@/db/repositories/quiz.repository';
import { QuizService } from '@/quiz/quiz.service';

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
    quizService = new QuizService(em.getRepository<Quiz, QuizRepository>(Quiz));
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
          { id: q1.id, prompt: 'Name a fruit', answer: 'Banana' },
          { id: q2.id, prompt: 'Name a vegetable', answer: 'Carrot' },
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
});
