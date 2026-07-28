import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import * as schema from '@/db/schema';
import { QuizService } from '@/quiz/quiz.service';

describe('QuizService (Postgres integration)', () => {
  let container: StartedPostgreSqlContainer;
  let client: Client;
  let db: NodePgDatabase<typeof schema>;
  let quizService: QuizService;

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

  beforeEach(() => {
    quizService = new QuizService(db);
  });

  afterEach(async () => {
    await client.query(
      'TRUNCATE answers, teams, game_sessions, questions, rounds, quizzes CASCADE',
    );
  });

  async function insertQuiz(title: string) {
    const [quiz] = await db
      .insert(schema.quizzes)
      .values({ title })
      .returning();
    return quiz;
  }

  async function insertRound(
    quizId: string,
    title: string,
    orderIndex: number,
    breakAfter = false,
  ) {
    const [round] = await db
      .insert(schema.rounds)
      .values({ quizId, title, orderIndex, breakAfter })
      .returning();
    return round;
  }

  async function insertQuestion(
    roundId: string,
    prompt: string,
    orderIndex: number,
    payload: { options?: string[]; answer?: string } = {},
  ) {
    const [question] = await db
      .insert(schema.questions)
      .values({
        roundId,
        orderIndex,
        type: payload.options ? 'multiple_choice' : 'free_text',
        prompt,
        payload,
        points: 1,
      })
      .returning();
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
    const round1 = await insertRound(quiz.id, 'Round 1', 0, true);
    await insertRound(quiz.id, 'Round 2', 1);
    const q1 = await insertQuestion(round1.id, 'Name a fruit', 0, {
      answer: 'Banana',
    });
    const q2 = await insertQuestion(round1.id, 'Name a vegetable', 1, {
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
    const round = await insertRound(quiz.id, 'Round 1', 0);
    const question = await insertQuestion(round.id, 'Capital of France?', 0, {
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
});
