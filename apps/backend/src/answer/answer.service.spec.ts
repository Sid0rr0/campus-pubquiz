import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import * as schema from '@/db/schema';
import { AnswerService } from '@/answer/answer.service';

describe('AnswerService (Postgres integration)', () => {
  let container: StartedPostgreSqlContainer;
  let client: Client;
  let db: NodePgDatabase<typeof schema>;
  let answerService: AnswerService;
  let sessionId: string;
  let questionId: string;
  let roundId: string;

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

  beforeEach(async () => {
    answerService = new AnswerService(db);
    const [quiz] = await db
      .insert(schema.quizzes)
      .values({ title: 'Answer Test Quiz' })
      .returning();
    const [round] = await db
      .insert(schema.rounds)
      .values({ quizId: quiz.id, title: 'Round 1', orderIndex: 0 })
      .returning();
    const [question] = await db
      .insert(schema.questions)
      .values({
        roundId: round.id,
        orderIndex: 0,
        type: 'free_text',
        prompt: 'Name a fruit',
        points: 1,
      })
      .returning();
    const [session] = await db
      .insert(schema.gameSessions)
      .values({ quizId: quiz.id, joinCode: 'ABCDEF' })
      .returning();
    questionId = question.id;
    sessionId = session.id;
    roundId = round.id;
  });

  afterEach(async () => {
    await client.query(
      'TRUNCATE answers, teams, game_sessions, questions, rounds, quizzes CASCADE',
    );
  });

  async function insertTeam(name: string, token: string) {
    const [team] = await db
      .insert(schema.teams)
      .values({ gameSessionId: sessionId, name, token })
      .returning();
    return team;
  }

  it('creates a new ungraded answer for a team', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');

    const result = await answerService.submit(
      sessionId,
      questionId,
      team.id,
      'Banana',
    );

    expect(result.teamId).toBe(team.id);
    expect(result.teamName).toBe('The Quizzards');
    expect(result.value).toBe('Banana');
  });

  it('overwrites the previous answer for the same team and question (last-write-wins)', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');

    await answerService.submit(sessionId, questionId, team.id, 'Banana');
    await answerService.submit(sessionId, questionId, team.id, 'Apple');

    const answers = await answerService.listForQuestion(sessionId, questionId);
    expect(answers).toHaveLength(1);
    expect(answers[0].value).toBe('Apple');
  });

  it('does not disturb another team answering the same question', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');

    await answerService.submit(sessionId, questionId, teamA.id, 'Banana');
    await answerService.submit(sessionId, questionId, teamB.id, 'Mango');

    const answers = await answerService.listForQuestion(sessionId, questionId);
    expect(answers).toHaveLength(2);
    expect(answers.find((a) => a.teamId === teamA.id)?.value).toBe('Banana');
    expect(answers.find((a) => a.teamId === teamB.id)?.value).toBe('Mango');
  });

  it('lists answers with a null pointsAwarded before grading', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');
    await answerService.submit(sessionId, questionId, team.id, 'Banana');

    const [answer] = await answerService.listForQuestion(sessionId, questionId);
    expect(answer.pointsAwarded).toBeNull();
  });

  it('grades an answer, returning the questionId it belongs to', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');
    const submitted = await answerService.submit(
      sessionId,
      questionId,
      team.id,
      'Banana',
    );

    const graded = await answerService.grade(submitted.answerId, 2);
    expect(graded.questionId).toBe(questionId);

    const [answer] = await answerService.listForQuestion(sessionId, questionId);
    expect(answer.pointsAwarded).toBe(2);
  });

  it('computes a leaderboard summing graded points per team, sorted descending', async () => {
    const [question2] = await db
      .insert(schema.questions)
      .values({
        roundId,
        orderIndex: 1,
        type: 'free_text',
        prompt: 'Name a vegetable',
        points: 1,
      })
      .returning();

    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');

    const answerA1 = await answerService.submit(
      sessionId,
      questionId,
      teamA.id,
      'Banana',
    );
    const answerA2 = await answerService.submit(
      sessionId,
      question2.id,
      teamA.id,
      'Carrot',
    );
    const answerB1 = await answerService.submit(
      sessionId,
      questionId,
      teamB.id,
      'Mango',
    );

    await answerService.grade(answerA1.answerId, 2);
    await answerService.grade(answerA2.answerId, 1);
    await answerService.grade(answerB1.answerId, 1);

    const leaderboard = await answerService.computeLeaderboard(sessionId);

    expect(leaderboard).toEqual([
      { teamId: teamA.id, teamName: 'Team A', totalPoints: 3 },
      { teamId: teamB.id, teamName: 'Team B', totalPoints: 1 },
    ]);
  });

  it('treats ungraded answers as zero points in the leaderboard', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');
    await answerService.submit(sessionId, questionId, team.id, 'Banana');

    const leaderboard = await answerService.computeLeaderboard(sessionId);
    expect(leaderboard).toEqual([
      { teamId: team.id, teamName: 'The Quizzards', totalPoints: 0 },
    ]);
  });
});
