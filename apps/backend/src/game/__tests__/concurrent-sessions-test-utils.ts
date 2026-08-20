import { DEFAULT_SESSION_SETTINGS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import type { SeededGame } from '@/db/seed.types';
import { GameGateway } from '@/game/game.gateway';
import { GameStateService } from '@/game/game-state.service';
import {
  TEST_SESSION_TOKEN,
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeAnswerService,
  createFakeBonusService,
  createFakeSessionService,
  createMockSocket,
  createMockServer,
  asSocket,
  asServer,
  asSeedService,
  asGameProgressRepository,
  asTeamService,
  asAnswerService,
  asBonusService,
  asSessionService,
  type MockServer,
  type MockSocket,
} from '@/game/__tests__/test-utils';

// Two single-question, breakAfter:true games so each session can independently
// reach question_open and then the locking countdown with a single ADVANCE.
export const SESSION_A_GAME: SeededGame = {
  quizId: 10,
  gameSessionId: 301,
  joinCode: 'AAAAAA',
  rounds: [
    {
      id: 91,
      title: 'Round Alpha',
      breakAfter: true,
      questions: [
        {
          id: 501,
          type: 'free_text',
          prompt: 'QA',
          points: 5,
          answer: 'Answer A',
        },
      ],
    },
  ],
  settings: DEFAULT_SESSION_SETTINGS,
};

export const SESSION_B_GAME: SeededGame = {
  quizId: 20,
  gameSessionId: 302,
  joinCode: 'BBBBBB',
  rounds: [
    {
      id: 92,
      title: 'Round Beta',
      breakAfter: true,
      questions: [
        {
          id: 502,
          type: 'free_text',
          prompt: 'QB',
          points: 7,
          answer: 'Answer B',
        },
      ],
    },
  ],
  settings: DEFAULT_SESSION_SETTINGS,
};

/** teamService.join/listForSession keyed by gameSessionId, so session A and B
 * each see only their own team even though both share one mock instance. */
export function createSessionAwareTeamService() {
  const teamsBySession: Record<number, { id: number; name: string }> = {
    301: { id: 61, name: 'Team Alpha' },
    302: { id: 62, name: 'Team Beta' },
  };
  return {
    join: jest.fn((gameSessionId: number, teamName: string) => {
      const team = teamsBySession[gameSessionId];
      return Promise.resolve({
        id: team.id,
        name: teamName,
        token: `token-${team.id}`,
        code: `code-${team.id}`,
      });
    }),
    listForSession: jest.fn((gameSessionId: number) => {
      const team = teamsBySession[gameSessionId];
      return Promise.resolve([{ teamId: team.id, teamName: team.name }]);
    }),
    removeFromRoster: jest.fn().mockResolvedValue(undefined),
  };
}

/** answerService methods keyed by gameSessionId/answerId, so grading or
 * submitting in one session can never surface in the other's snapshot. */
export function createSessionAwareAnswerService() {
  const answersBySession: Record<
    number,
    { answerId: number; teamId: number; teamName: string }
  > = {
    301: { answerId: 701, teamId: 61, teamName: 'Team Alpha' },
    302: { answerId: 702, teamId: 62, teamName: 'Team Beta' },
  };
  return {
    submit: jest.fn(
      (
        gameSessionId: number,
        _questionId: number,
        teamId: number,
        value: string,
      ) => {
        const answer = answersBySession[gameSessionId];
        return Promise.resolve({
          answerId: answer.answerId,
          teamId,
          teamName: answer.teamName,
          value,
        });
      },
    ),
    listForQuestion: jest.fn((gameSessionId: number) => {
      const answer = answersBySession[gameSessionId];
      return Promise.resolve([
        {
          answerId: answer.answerId,
          teamId: answer.teamId,
          teamName: answer.teamName,
          value: 'submitted',
          pointsAwarded: 0,
          gradedAt: null,
        },
      ]);
    }),
    listForTeam: jest.fn().mockResolvedValue([]),
    grade: jest.fn((_gameSessionId: number, answerId: number) => {
      const questionId = answerId === 701 ? 501 : 502;
      return Promise.resolve({ questionId });
    }),
    listUngradedQuestionIds: jest.fn().mockResolvedValue([]),
    gradeClosestGuess: jest.fn().mockResolvedValue([]),
    computeLeaderboard: jest.fn((gameSessionId: number) => {
      const answer = answersBySession[gameSessionId];
      return Promise.resolve([
        {
          teamId: answer.teamId,
          teamName: answer.teamName,
          totalPoints: 5,
          bonusPoints: 0,
        },
      ]);
    }),
  };
}

export interface ConcurrentSessionsTestState {
  gameStateService: GameStateService;
  gateway: GameGateway;
  server: MockServer;
  teamService: ReturnType<typeof createSessionAwareTeamService>;
  answerService: ReturnType<typeof createSessionAwareAnswerService>;
}

export interface ConcurrentSessionsTestContext {
  state: ConcurrentSessionsTestState;
  /** Opens session A's only question (the session seeded at onModuleInit). */
  openSessionA: () => Promise<MockSocket>;
  /** Creates session B directly via GameStateService (mirroring POST
   * /sessions) and opens its only question. */
  createAndOpenSessionB: () => Promise<MockSocket>;
}

/**
 * Wires a GameGateway backed by two independent, session-aware fake
 * services (one seeded game per join code) so concurrency-isolation tests
 * can drive session A and session B side by side.
 *
 * Call inside a top-level `describe` block — see setupAnswerServiceTest's
 * doc comment for why the returned `state` object must be read inside
 * `it()` bodies rather than captured at module scope.
 */
export function setupConcurrentSessionsTest(): ConcurrentSessionsTestContext {
  const state = {} as ConcurrentSessionsTestState;

  beforeEach(async () => {
    const seedService = {
      seed: jest.fn().mockResolvedValue(SESSION_A_GAME),
      loadGame: jest.fn().mockResolvedValue(SESSION_B_GAME),
      createSession: jest
        .fn()
        .mockResolvedValue({ gameSessionId: 302, joinCode: 'BBBBBB' }),
      updateSettings: jest.fn(),
    };
    state.gameStateService = new GameStateService(
      asSeedService(seedService),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
    );
    await state.gameStateService.onModuleInit();

    state.teamService = createSessionAwareTeamService();
    state.answerService = createSessionAwareAnswerService();
    state.gateway = new GameGateway(
      state.gameStateService,
      asTeamService(state.teamService),
      asAnswerService(state.answerService),
      asBonusService(createFakeBonusService()),
      asSessionService(createFakeSessionService()),
      createFakeOrm(),
    );
    state.server = createMockServer();
    state.gateway.server = asServer(state.server);
  });

  async function openSessionA(): Promise<MockSocket> {
    const admin = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: TEST_SESSION_TOKEN },
      'socket-1',
      'AAAAAA',
    );
    await state.gateway.handleConnection(asSocket(admin));
    await state.gateway.handleAdminAction(asSocket(admin), {
      action: 'START_QUIZ',
    }); // -> rules
    await state.gateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    }); // -> round_intro
    await state.gateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    }); // -> question_open (q501)
    return admin;
  }

  async function createAndOpenSessionB(): Promise<MockSocket> {
    await state.gameStateService.createSession(20);
    const admin = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: TEST_SESSION_TOKEN },
      'socket-1',
      'BBBBBB',
    );
    await state.gateway.handleConnection(asSocket(admin));
    await state.gateway.handleAdminAction(asSocket(admin), {
      action: 'START_QUIZ',
    }); // -> rules
    await state.gateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    }); // -> round_intro
    await state.gateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    }); // -> question_open (q502)
    return admin;
  }

  return { state, openSessionA, createAndOpenSessionB };
}
