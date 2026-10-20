import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RequestContext } from '@mikro-orm/postgresql';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Server } from 'node:http';
import type { AuthUser, QuizPreviewPayload } from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SESSION_COOKIE_NAME } from '@/auth/session-cookie';
import { SessionGuard } from '@/auth/session.guard';
import { SessionService } from '@/auth/session.service';
import { GameSession } from '@/db/entities/game-session.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { QuestionRepository } from '@/db/repositories/question.repository';
import { QuizRepository } from '@/db/repositories/quiz.repository';
import { RoundRepository } from '@/db/repositories/round.repository';
import { SeedService } from '@/db/seed.service';
import { LiveEditService } from '@/game/live-edit/live-edit.service';
import { GameStateService } from '@/game/state/game-state.service';
import { QuizController } from '@/quiz/quiz.controller';
import { QuizPreviewService } from '@/quiz/quiz-preview.service';
import { QuizService } from '@/quiz/quiz.service';
import {
  makeQuestion,
  makeRound,
} from '@/quiz/__tests__/quiz-draft-test-utils';
import { useTestDatabase } from '@/test-db/test-database';
import { createTestDatabaseModule } from '@/test-db/test-database.module';

const USERS: Record<string, AuthUser> = {
  'admin-token': { id: 1, username: 'ada', role: 'admin', status: 'active' },
  'moderator-token': {
    id: 2,
    username: 'mo',
    role: 'moderator',
    status: 'active',
  },
};

describe('GET /quizzes/:id/preview (Postgres integration)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let gameState: { [method: string]: jest.Mock };
  let quizService: QuizService;

  beforeEach(async () => {
    gameState = {
      getActiveQuizId: jest.fn(),
      createSession: jest.fn(),
      placeSession: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [createTestDatabaseModule(db.orm)],
      controllers: [QuizController],
      providers: [
        QuizService,
        QuizPreviewService,
        SeedService,
        SessionGuard,
        RolesGuard,
        { provide: GameStateService, useValue: gameState },
        { provide: LiveEditService, useValue: {} },
        {
          provide: SessionService,
          useValue: {
            validate: (token: string) =>
              Promise.resolve(USERS[token] ? { user: USERS[token] } : null),
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    // What MikroOrmModule's middleware does in the running app: one fork per request.
    app.use((_request: unknown, _response: unknown, next: () => void) => {
      RequestContext.create(db.orm.em, next);
    });
    await app.init();
    // Fixtures are saved through the spec's own fork, never through the app's.
    const em = db.orm.em.fork();
    quizService = new QuizService(
      em.getRepository<Quiz, QuizRepository>(Quiz),
      em.getRepository<Round, RoundRepository>(Round),
      em.getRepository<Question, QuestionRepository>(Question),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  function get(path: string, token?: string): request.Test {
    const call = request(app.getHttpServer() as Server).get(path);
    return token ? call.set('Cookie', `${SESSION_COOKIE_NAME}=${token}`) : call;
  }

  async function saveQuiz(): Promise<number> {
    const saved = await quizService.create('Preview me', [
      makeRound({
        title: 'Geography',
        questions: [
          makeQuestion({ prompt: 'Capital of France?', answer: 'Paris' }),
          makeQuestion({ prompt: 'Largest planet?', answer: 'Jupiter' }),
        ],
      }),
    ]);
    return saved.quizId;
  }

  it('lets an admin read the preview steps of the saved quiz', async () => {
    const quizId = await saveQuiz();

    const response = await get(`/quizzes/${quizId}/preview`, 'admin-token');

    expect(response.status).toBe(200);
    const body = response.body as QuizPreviewPayload;
    expect(body.mode).toBe('answer_after_question');
    expect(body.steps.map(({ screen }) => screen.kind)).toEqual([
      'round_title',
      'question',
      'reveal',
      'question',
      'reveal',
    ]);
    expect(body.steps[2].screen).toMatchObject({
      kind: 'reveal',
      question: { prompt: 'Capital of France?', answer: 'Paris' },
    });
    expect(body.quiz.roundTitles).toEqual(['Geography']);
  });

  it('lets a moderator read it too', async () => {
    const quizId = await saveQuiz();

    const response = await get(`/quizzes/${quizId}/preview`, 'moderator-token');

    expect(response.status).toBe(200);
  });

  it('refuses a logged-out visitor', async () => {
    const quizId = await saveQuiz();

    const response = await get(`/quizzes/${quizId}/preview`);

    expect(response.status).toBe(401);
  });

  it('answers 404 for a quiz that does not exist', async () => {
    const response = await get('/quizzes/9999/preview', 'admin-token');

    expect(response.status).toBe(404);
  });

  it('accepts mode=night and answers with the night order', async () => {
    const quizId = await saveQuiz();

    const response = await get(
      `/quizzes/${quizId}/preview?mode=night`,
      'admin-token',
    );

    expect(response.status).toBe(200);
    const body = response.body as QuizPreviewPayload;
    expect(body.mode).toBe('night');
    expect(body.steps.map(({ screen }) => screen.kind)).toEqual([
      'round_overview',
      'round_title',
      'question',
      'question',
      'break_intro',
      'reveal_intro',
      'reveal',
      'reveal',
    ]);
  });

  it('answers 200 in the night order for a quiz with a round that has no questions', async () => {
    // The editor refuses to save an empty round, so the questions are removed
    // from a saved quiz's rounds directly.
    const questionRound = (title: string) =>
      makeRound({
        title,
        questions: [makeQuestion({ prompt: 'One?', answer: 'Yes' })],
      });
    const saved = await quizService.create('Gaps', [
      questionRound('Empty'),
      questionRound('Full'),
      questionRound('Empty again'),
    ]);
    const em = db.orm.em.fork();
    const savedRounds = await em.find(
      Round,
      { quiz: saved.quizId },
      { orderBy: { orderIndex: 'asc' } },
    );
    await em.nativeDelete(Question, {
      round: { $in: [savedRounds[0].id, savedRounds[2].id] },
    });

    const response = await get(
      `/quizzes/${saved.quizId}/preview?mode=night`,
      'admin-token',
    );

    expect(response.status).toBe(200);
    const body = response.body as QuizPreviewPayload;
    expect(body.steps.map(({ screen }) => screen.kind)).toEqual([
      'round_overview',
      'round_title',
      'round_title',
      'question',
      'break_intro',
      'reveal_intro',
      'reveal',
      'round_title',
    ]);
  });

  it('answers 400 for a mode that is not one of the preview modes', async () => {
    const quizId = await saveQuiz();

    const response = await get(
      `/quizzes/${quizId}/preview?mode=sideways`,
      'admin-token',
    );

    expect(response.status).toBe(400);
  });

  it('reflects the quiz as last saved', async () => {
    const quizId = await saveQuiz();
    await quizService.update(quizId, 'Preview me', [
      makeRound({
        title: 'Renamed round',
        questions: [makeQuestion({ prompt: 'Only one?', answer: 'Yes' })],
      }),
    ]);

    const response = await get(`/quizzes/${quizId}/preview`, 'admin-token');

    const body = response.body as QuizPreviewPayload;
    expect(body.quiz.roundTitles).toEqual(['Renamed round']);
    expect(body.steps).toHaveLength(3);
  });

  it('writes no rows and adds no session', async () => {
    const quizId = await saveQuiz();
    const em = db.orm.em.fork();
    const counts = async () => [
      await em.count(GameSession),
      await em.count(Quiz),
      await em.count(Round),
      await em.count(Question),
    ];
    const before = await counts();

    await get(`/quizzes/${quizId}/preview`, 'admin-token').expect(200);

    expect(before[0]).toBe(0);
    expect(await counts()).toEqual(before);
    for (const method of Object.values(gameState)) {
      expect(method).not.toHaveBeenCalled();
    }
  });
});
