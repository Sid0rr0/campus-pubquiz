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

  it('lists every quiz with its id and title', async () => {
    const quizA = await insertQuiz('Campus Pub Quiz Night');
    const quizB = await insertQuiz('Imported Quiz');

    const quizzes = await quizService.list();

    expect(quizzes).toHaveLength(2);
    expect(quizzes).toEqual(
      expect.arrayContaining([
        { id: quizA.id, title: 'Campus Pub Quiz Night' },
        { id: quizB.id, title: 'Imported Quiz' },
      ]),
    );
  });

  it('returns an empty list when no quizzes exist', async () => {
    await expect(quizService.list()).resolves.toEqual([]);
  });
});
