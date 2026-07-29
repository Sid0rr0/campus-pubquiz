import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { MikroORM, type EntityManager } from '@mikro-orm/postgresql';
import { Answer } from '@/db/entities/answer.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { Team } from '@/db/entities/team.entity';

describe('MikroORM entities (Postgres integration)', () => {
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
    // last-write-wins over FK order: children first
    await em
      .getConnection()
      .execute(
        'TRUNCATE answers, game_session_teams, teams, game_sessions, questions, rounds, quizzes CASCADE',
      );
  });

  it('persists the full authoring chain: quiz -> round (with breakAfter) -> question', async () => {
    const quiz = em.create(Quiz, { title: 'Campus Pub Quiz Night' });
    const round = em.create(Round, {
      quiz,
      title: 'Round 2',
      orderIndex: 1,
      breakAfter: true,
    });
    const question = em.create(Question, {
      round,
      orderIndex: 0,
      type: 'multiple_choice',
      prompt: 'Capital of France?',
      answer: 'Paris',
      payload: { options: ['Paris', 'London', 'Berlin', 'Rome'] },
      points: 2,
    });
    await em.flush();

    expect(round.breakAfter).toBe(true);
    expect(question.answer).toBe('Paris');
    expect(question.payload).toEqual({
      options: ['Paris', 'London', 'Berlin', 'Rome'],
    });
  });

  it('persists the full runtime chain: game session -> team -> answer', async () => {
    const quiz = em.create(Quiz, { title: 'Runtime Quiz' });
    const round = em.create(Round, {
      quiz,
      title: 'Round 1',
      orderIndex: 0,
      breakAfter: false,
    });
    const question = em.create(Question, {
      round,
      orderIndex: 0,
      type: 'free_text',
      prompt: 'Name a fruit',
      answer: 'Apple',
      points: 1,
    });
    const session = em.create(GameSession, { quiz, joinCode: 'ABCD' });
    const team = em.create(Team, {
      name: 'The Quizzards',
      token: 'team-token-1',
      code: 'team-code-1',
    });
    em.create(GameSessionTeam, { gameSession: session, team });
    const answer = em.create(Answer, {
      gameSession: session,
      question,
      team,
      value: 'Banana',
    });
    await em.flush();

    const found = await em.findOneOrFail(Answer, { id: answer.id });
    expect(found.value).toBe('Banana');
    expect(found.team.id).toBe(team.id);
  });

  it('rejects an answer for a team that does not exist (referential integrity)', async () => {
    const quiz = em.create(Quiz, { title: 'FK Quiz' });
    const round = em.create(Round, {
      quiz,
      title: 'Round 1',
      orderIndex: 0,
      breakAfter: false,
    });
    const question = em.create(Question, {
      round,
      orderIndex: 0,
      type: 'free_text',
      prompt: 'Q',
      answer: 'A',
      points: 1,
    });
    const session = em.create(GameSession, { quiz, joinCode: 'FKFK' });
    await em.flush();

    em.create(Answer, {
      gameSession: session,
      question,
      team: 999_999_999,
      value: 'anything',
    });

    await expect(em.flush()).rejects.toThrow();
  });

  it('supports last-write-wins revision via upsert on (session, question, team)', async () => {
    const quiz = em.create(Quiz, { title: 'Revise Quiz' });
    const round = em.create(Round, {
      quiz,
      title: 'Round 1',
      orderIndex: 0,
      breakAfter: false,
    });
    const question = em.create(Question, {
      round,
      orderIndex: 0,
      type: 'free_text',
      prompt: 'Q',
      answer: 'A',
      points: 1,
    });
    const session = em.create(GameSession, { quiz, joinCode: 'REVI' });
    const team = em.create(Team, {
      name: 'Revisers',
      token: 'team-token-2',
      code: 'team-code-2',
    });
    em.create(GameSessionTeam, { gameSession: session, team });
    await em.flush();

    const answers = em.getRepository(Answer);
    const now = new Date();
    await answers.upsert(
      {
        gameSession: session,
        question,
        team,
        value: 'First answer',
        createdAt: now,
        updatedAt: now,
      },
      { onConflictFields: ['gameSession', 'question', 'team'] },
    );
    await answers.upsert(
      {
        gameSession: session,
        question,
        team,
        value: 'Revised answer',
        createdAt: now,
        updatedAt: new Date(),
      },
      {
        onConflictFields: ['gameSession', 'question', 'team'],
        onConflictAction: 'merge',
        onConflictMergeFields: ['value', 'updatedAt'],
      },
    );

    const rows = await em.find(Answer, { gameSession: session });

    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe('Revised answer');
  });
});
