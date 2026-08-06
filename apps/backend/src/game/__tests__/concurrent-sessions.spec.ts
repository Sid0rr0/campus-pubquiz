import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
} from '@campus-pubquiz/types';
import type { SeededGame } from '@/db/seed.types';
import { GameGateway } from '@/game/game.gateway';
import { GameStateService } from '@/game/game-state.service';
import {
  TEST_SESSION_TOKEN,
  createFakeOrm,
  createFakeGameProgressRepository,
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
} from './test-utils';

// Two single-question, breakAfter:true games so each session can independently
// reach question_open and then the locking countdown with a single ADVANCE.
const SESSION_A_GAME: SeededGame = {
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
};

const SESSION_B_GAME: SeededGame = {
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
};

/** teamService.join/listForSession keyed by gameSessionId, so session A and B
 * each see only their own team even though both share one mock instance. */
function createSessionAwareTeamService() {
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
function createSessionAwareAnswerService() {
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

describe('GameGateway — concurrent sessions (phase 6 verification)', () => {
  let gameStateService: GameStateService;
  let gateway: GameGateway;
  let server: MockServer;
  let teamService: ReturnType<typeof createSessionAwareTeamService>;
  let answerService: ReturnType<typeof createSessionAwareAnswerService>;

  beforeEach(async () => {
    const seedService = {
      seed: jest.fn().mockResolvedValue(SESSION_A_GAME),
      loadGame: jest.fn().mockResolvedValue(SESSION_B_GAME),
      createSession: jest
        .fn()
        .mockResolvedValue({ gameSessionId: 302, joinCode: 'BBBBBB' }),
    };
    gameStateService = new GameStateService(
      asSeedService(seedService),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
    );
    await gameStateService.onModuleInit();

    teamService = createSessionAwareTeamService();
    answerService = createSessionAwareAnswerService();
    gateway = new GameGateway(
      gameStateService,
      asTeamService(teamService),
      asAnswerService(answerService),
      asBonusService(createFakeBonusService()),
      asSessionService(createFakeSessionService()),
      createFakeOrm(),
    );
    server = createMockServer();
    gateway.server = asServer(server);
  });

  /** Opens session A's only question (the session seeded at onModuleInit). */
  async function openSessionA() {
    const admin = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: TEST_SESSION_TOKEN },
      'socket-1',
      'AAAAAA',
    );
    await gateway.handleConnection(asSocket(admin));
    await gateway.handleAdminAction(asSocket(admin), { action: 'START_QUIZ' });
    await gateway.handleAdminAction(asSocket(admin), { action: 'ADVANCE' }); // -> round_intro
    await gateway.handleAdminAction(asSocket(admin), { action: 'ADVANCE' }); // -> question_open (q501)
    return admin;
  }

  /** Creates session B via SELECT_QUIZ (from a fresh admin connected to session
   * A first) and opens its only question. */
  async function createAndOpenSessionB() {
    const admin = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: TEST_SESSION_TOKEN },
      'socket-1',
      'AAAAAA',
    );
    await gateway.handleConnection(asSocket(admin));
    await gateway.handleSelectQuiz(asSocket(admin), { quizId: 20 });
    await gateway.handleAdminAction(asSocket(admin), { action: 'START_QUIZ' });
    await gateway.handleAdminAction(asSocket(admin), { action: 'ADVANCE' }); // -> round_intro
    await gateway.handleAdminAction(asSocket(admin), { action: 'ADVANCE' }); // -> question_open (q502)
    return admin;
  }

  it('advances two sessions through the state machine independently, with no shared progress', async () => {
    await openSessionA();
    expect(gameStateService.getSnapshot('AAAAAA').progress.status).toBe(
      'question_open',
    );

    const adminB = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: TEST_SESSION_TOKEN },
      'socket-1',
      'AAAAAA',
    );
    await gateway.handleConnection(asSocket(adminB));
    await gateway.handleSelectQuiz(asSocket(adminB), { quizId: 20 });

    // Creating B must not touch A's already-open question.
    expect(gameStateService.getSnapshot('AAAAAA').progress.status).toBe(
      'question_open',
    );
    expect(gameStateService.getSnapshot('BBBBBB').progress.status).toBe(
      'lobby',
    );

    server.to.mockClear();
    server.emit.mockClear();
    await gateway.handleAdminAction(asSocket(adminB), { action: 'START_QUIZ' });
    await gateway.handleAdminAction(asSocket(adminB), { action: 'ADVANCE' });
    await gateway.handleAdminAction(asSocket(adminB), { action: 'ADVANCE' });

    expect(gameStateService.getSnapshot('AAAAAA').progress.status).toBe(
      'question_open',
    );
    expect(gameStateService.getSnapshot('BBBBBB').progress.status).toBe(
      'question_open',
    );
    expect(gameStateService.getSnapshot('AAAAAA').currentQuestion?.id).toBe(
      501,
    );
    expect(gameStateService.getSnapshot('BBBBBB').currentQuestion?.id).toBe(
      502,
    );
    expect(gameStateService.getGameSessionId('AAAAAA')).toBe(301);
    expect(gameStateService.getGameSessionId('BBBBBB')).toBe(302);

    // The last ADVANCE (B's) must only have broadcast to B's rooms.
    expect(server.to).toHaveBeenCalledWith(
      sessionRoom('BBBBBB', SOCKET_ROOMS.DISPLAY),
    );
    expect(server.to).not.toHaveBeenCalledWith(
      sessionRoom('AAAAAA', SOCKET_ROOMS.DISPLAY),
    );
  });

  it('keeps rosters, submitted answers, and grading fully isolated between two concurrently open sessions', async () => {
    await openSessionA();
    await createAndOpenSessionB();

    const playerA = createMockSocket(
      SOCKET_ROOMS.PLAYERS,
      {},
      'player-a',
      'AAAAAA',
    );
    await gateway.handleConnection(asSocket(playerA));
    await gateway.handleJoinPlayers(asSocket(playerA), {
      teamName: 'Team Alpha',
      joinCode: 'AAAAAA',
    });

    const playerB = createMockSocket(
      SOCKET_ROOMS.PLAYERS,
      {},
      'player-b',
      'BBBBBB',
    );
    await gateway.handleConnection(asSocket(playerB));
    await gateway.handleJoinPlayers(asSocket(playerB), {
      teamName: 'Team Beta',
      joinCode: 'BBBBBB',
    });

    expect(gameStateService.getSnapshot('AAAAAA').teams).toEqual([
      expect.objectContaining({ teamId: 61, teamName: 'Team Alpha' }),
    ]);
    expect(gameStateService.getSnapshot('BBBBBB').teams).toEqual([
      expect.objectContaining({ teamId: 62, teamName: 'Team Beta' }),
    ]);

    await gateway.handleSubmitAnswer(asSocket(playerA), {
      questionId: 501,
      teamId: 61,
      value: 'foo',
    });
    await gateway.handleSubmitAnswer(asSocket(playerB), {
      questionId: 502,
      teamId: 62,
      value: 'bar',
    });

    expect(answerService.submit).toHaveBeenNthCalledWith(
      1,
      301,
      501,
      61,
      'foo',
    );
    expect(answerService.submit).toHaveBeenNthCalledWith(
      2,
      302,
      502,
      62,
      'bar',
    );
    expect(gameStateService.getSnapshot('AAAAAA').answeredTeamIds).toEqual([
      61,
    ]);
    expect(gameStateService.getSnapshot('BBBBBB').answeredTeamIds).toEqual([
      62,
    ]);

    const adminA = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: TEST_SESSION_TOKEN },
      'admin-grade-a',
      'AAAAAA',
    );
    await gateway.handleConnection(asSocket(adminA));
    await gateway.handleGradeAnswer(asSocket(adminA), {
      answerId: 701,
      pointsAwarded: 5,
    });

    // Only A was graded — its leaderboard is populated, B's is still empty.
    expect(gameStateService.getSnapshot('AAAAAA').leaderboard).toEqual([
      expect.objectContaining({ teamId: 61, teamName: 'Team Alpha' }),
    ]);
    expect(gameStateService.getSnapshot('BBBBBB').leaderboard).toEqual([]);
  });

  it('arms independent question-lock timers per session; cancelling one never disturbs the other', async () => {
    jest.useFakeTimers();
    try {
      const adminA = await openSessionA();
      const adminB = await createAndOpenSessionB();

      await gateway.handleAdminAction(asSocket(adminA), { action: 'ADVANCE' }); // A -> locking
      await gateway.handleAdminAction(asSocket(adminB), { action: 'ADVANCE' }); // B -> locking

      expect(gameStateService.getQuestionLockAt('AAAAAA')).not.toBeNull();
      expect(gameStateService.getQuestionLockAt('BBBBBB')).not.toBeNull();

      await gateway.handleAdminAction(asSocket(adminB), { action: 'PREVIOUS' }); // cancels B's timer only
      expect(gameStateService.getQuestionLockAt('BBBBBB')).toBeNull();
      expect(gameStateService.getQuestionLockAt('AAAAAA')).not.toBeNull();

      server.to.mockClear();
      server.emit.mockClear();
      await jest.advanceTimersByTimeAsync(60_000);

      expect(gameStateService.getSnapshot('AAAAAA').progress.status).toBe(
        'break_intro',
      );
      expect(gameStateService.getSnapshot('BBBBBB').progress.status).toBe(
        'question_open',
      );
      expect(server.to).toHaveBeenCalledWith(
        sessionRoom('AAAAAA', SOCKET_ROOMS.DISPLAY),
      );
      expect(server.to).not.toHaveBeenCalledWith(
        sessionRoom('BBBBBB', SOCKET_ROOMS.DISPLAY),
      );
      expect(server.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.STATE_UPDATED,
        expect.objectContaining({
          joinCode: 'AAAAAA',
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
