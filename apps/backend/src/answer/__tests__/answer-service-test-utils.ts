import type { EntityManager } from '@mikro-orm/postgresql';
import type { AnswerView, ScoredQuestion } from '@campus-pubquiz/types';
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
import { AnswerService, type GradableQuestion } from '@/answer/answer.service';
import { useTestDatabase } from '@/test-db/test-database';

/** Key-fix regrade of an auto-graded question: `question` is the corrected key, rescored with an optional kahoot timer. */
export async function regradeAuto(
  service: AnswerService,
  gameSessionId: number,
  question: GradableQuestion,
  kahootTimerSeconds: number | null = null,
): Promise<void> {
  await service.regradeForKeyFix(
    gameSessionId,
    question,
    question,
    kahootTimerSeconds,
    false,
  );
}

/** Key-fix regrade of a match-or-human question against `previous`, the key before the fix. */
export async function regradeMatchOrHuman(
  service: AnswerService,
  gameSessionId: number,
  question: GradableQuestion,
  previous: ScoredQuestion,
): Promise<void> {
  await service.regradeForKeyFix(
    gameSessionId,
    question,
    previous,
    null,
    false,
  );
}

/** Key-fix regrade of a closest_guess question whose batch already ran: re-runs the batch and returns the answers. */
export async function regradeBatch(
  service: AnswerService,
  gameSessionId: number,
  question: GradableQuestion,
): Promise<AnswerView[]> {
  const { answers } = await service.regradeForKeyFix(
    gameSessionId,
    question,
    question,
    null,
    true,
  );
  return answers;
}

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
