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
import { AnswerRepository } from '@/db/repositories/answer.repository';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { QuestionRepository } from '@/db/repositories/question.repository';
import { TeamRepository } from '@/db/repositories/team.repository';
import { AnswerService } from '@/answer/answer.service';

export interface AnswerServiceTestState {
  em: EntityManager;
  answerService: AnswerService;
  session: GameSession;
  question: Question;
  round: Round;
}

export interface AnswerServiceTestContext {
  state: AnswerServiceTestState;
  insertTeam: (name: string, token: string) => Promise<Team>;
}

/**
 * Spins up a fresh Postgres testcontainer + MikroORM instance for
 * AnswerService integration tests, seeding a quiz/round/free_text-question/
 * game-session before each test and truncating game tables after each.
 *
 * Call inside a top-level `describe` block — Jest attaches the
 * beforeAll/beforeEach/afterEach/afterAll hooks registered here to whichever
 * describe is currently executing. The returned `state` object is mutated in
 * place every `beforeEach`, so read its properties inside `it()` bodies
 * (after the hook has run), not at module scope.
 */
export function setupAnswerServiceTest(): AnswerServiceTestContext {
  let container: StartedPostgreSqlContainer;
  let orm: MikroORM;
  const state = {} as AnswerServiceTestState;

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

  beforeEach(async () => {
    state.em = orm.em.fork();
    state.answerService = new AnswerService(
      state.em.getRepository<Answer, AnswerRepository>(Answer),
      state.em.getRepository<Team, TeamRepository>(Team),
      state.em.getRepository<GameSessionTeam, GameSessionTeamRepository>(
        GameSessionTeam,
      ),
      state.em.getRepository<Question, QuestionRepository>(Question),
    );
    const quiz = state.em.create(Quiz, { title: 'Answer Test Quiz' });
    state.round = state.em.create(Round, {
      quiz,
      title: 'Round 1',
      orderIndex: 0,
    });
    state.question = state.em.create(Question, {
      round: state.round,
      orderIndex: 0,
      type: 'free_text',
      prompt: 'Name a fruit',
      answer: 'Apple',
      points: 1,
    });
    state.session = state.em.create(GameSession, {
      quiz,
      joinCode: 'ABCDEF',
    });
    await state.em.flush();
  });

  afterEach(async () => {
    await state.em
      .getConnection()
      .execute(
        'TRUNCATE answers, bonus_awards, game_session_teams, teams, game_sessions, questions, rounds, quizzes CASCADE',
      );
  });

  async function insertTeam(name: string, token: string): Promise<Team> {
    const team = state.em.create(Team, { name, token, code: `code-${token}` });
    state.em.create(GameSessionTeam, { gameSession: state.session, team });
    await state.em.flush();
    return team;
  }

  return { state, insertTeam };
}
