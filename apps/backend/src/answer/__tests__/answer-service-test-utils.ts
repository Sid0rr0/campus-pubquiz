import type { EntityManager } from '@mikro-orm/postgresql';
import { Answer } from '@/db/entities/answer.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { Team } from '@/db/entities/team.entity';
import { AnswerRepository } from '@/db/repositories/answer.repository';
import { QuestionRepository } from '@/db/repositories/question.repository';
import { TeamRepository } from '@/db/repositories/team.repository';
import { AnswerService } from '@/answer/answer.service';
import { useTestDatabase } from '@/test-db/test-database';

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
 * Uses the shared test database (emptied after every test) for
 * AnswerService integration tests, seeding a quiz/round/free_text-question/
 * game-session before each test.
 *
 * Call inside a top-level `describe` block — Jest attaches the
 * beforeAll/beforeEach/afterEach/afterAll hooks registered here to whichever
 * describe is currently executing. The returned `state` object is mutated in
 * place every `beforeEach`, so read its properties inside `it()` bodies
 * (after the hook has run), not at module scope.
 */
export function setupAnswerServiceTest(): AnswerServiceTestContext {
  const db = useTestDatabase();
  const state = {} as AnswerServiceTestState;

  beforeEach(async () => {
    state.em = db.orm.em.fork();
    state.answerService = new AnswerService(
      state.em.getRepository<Answer, AnswerRepository>(Answer),
      state.em.getRepository<Team, TeamRepository>(Team),
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

  async function insertTeam(name: string, token: string): Promise<Team> {
    const team = state.em.create(Team, { name, token, code: `code-${token}` });
    state.em.create(GameSessionTeam, { gameSession: state.session, team });
    await state.em.flush();
    return team;
  }

  return { state, insertTeam };
}
