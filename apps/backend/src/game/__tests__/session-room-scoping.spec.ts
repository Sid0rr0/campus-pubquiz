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
  createFakeTeamService,
  createFakeAnswerService,
  createFakeBonusService,
  createFakeSessionService,
  createMockSocket,
  createMockServer,
  createTestGateway,
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

describe('GameGateway — session room scoping', () => {
  let gateway: GameGateway;
  let server: MockServer;

  beforeEach(async () => {
    ({ gateway, server } = await createTestGateway());
  });

  it('joins a connecting client to its session-scoped room when no code is given, defaulting to the current session', async () => {
    const display = createMockSocket(SOCKET_ROOMS.DISPLAY);
    await gateway.handleConnection(asSocket(display));

    expect(display.join).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.DISPLAY),
    );
  });

  it('joins a connecting client to the session named by an explicit code', async () => {
    const display = createMockSocket(
      SOCKET_ROOMS.DISPLAY,
      {},
      'socket-1',
      'ABCDEF',
    );
    await gateway.handleConnection(asSocket(display));

    expect(display.join).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.DISPLAY),
    );
    expect(display.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_SYNC,
      expect.objectContaining({ joinCode: 'ABCDEF' }),
    );
  });

  it('rejects a connection whose code does not resolve to a known session', async () => {
    const display = createMockSocket(
      SOCKET_ROOMS.DISPLAY,
      {},
      'socket-1',
      'NOSUCHCODE',
    );
    await gateway.handleConnection(asSocket(display));

    expect(display.join).not.toHaveBeenCalled();
    expect(display.disconnect).toHaveBeenCalled();
  });

  it("keeps two sessions fully isolated: an admin action in one only broadcasts to that session's rooms", async () => {
    // Session A ('ABCDEF') is seeded by createTestGateway and starts as the
    // default. A fresh admin connects with no code (resolves to A) and
    // spins up session B via SELECT_QUIZ, which becomes the new default and
    // migrates that admin's own socket into B's rooms — leaving A's state,
    // still in the map under 'ABCDEF', reachable only by explicitly
    // reconnecting with ?code=ABCDEF.
    const adminForB = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(adminForB));
    await gateway.handleSelectQuiz(asSocket(adminForB), { quizId: 2 });

    const adminForA = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: TEST_SESSION_TOKEN },
      'admin-a',
      'ABCDEF',
    );
    await gateway.handleConnection(asSocket(adminForA));

    server.to.mockClear();
    server.emit.mockClear();
    await gateway.handleAdminAction(asSocket(adminForA), {
      action: 'START_QUIZ',
    });

    expect(server.to).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.ADMIN),
    );
    expect(server.to).not.toHaveBeenCalledWith(
      sessionRoom('GHIJKL', SOCKET_ROOMS.ADMIN),
    );

    server.to.mockClear();
    server.emit.mockClear();
    await gateway.handleAdminAction(asSocket(adminForB), {
      action: 'START_QUIZ',
    });

    expect(server.to).toHaveBeenCalledWith(
      sessionRoom('GHIJKL', SOCKET_ROOMS.ADMIN),
    );
    expect(server.to).not.toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.ADMIN),
    );
  });

  it("clears the connection roster of the disconnecting socket's own session, not the current default", async () => {
    const adminForB = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(adminForB));
    await gateway.handleSelectQuiz(asSocket(adminForB), { quizId: 2 });
    // Default is now session B ('GHIJKL'); session A ('ABCDEF') still holds
    // the fixture team's connection from createTestGateway's seed data.

    const playerInA = createMockSocket(
      SOCKET_ROOMS.PLAYERS,
      {},
      'player-a',
      'ABCDEF',
    );
    await gateway.handleConnection(asSocket(playerInA));
    await gateway.handleJoinPlayers(asSocket(playerInA), {
      teamName: 'The Quizzards',
      joinCode: 'ABCDEF',
    });

    server.to.mockClear();
    server.emit.mockClear();
    gateway.handleDisconnect(asSocket(playerInA));

    expect(server.to).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.DISPLAY),
    );
    expect(server.to).not.toHaveBeenCalledWith(
      sessionRoom('GHIJKL', SOCKET_ROOMS.DISPLAY),
    );
  });

  it('clears every armed question-lock timer for every session on module destroy', async () => {
    // FIXTURE_SEEDED_GAME's only round has breakAfter: false, so it never
    // arms a lock timer — this test needs its own breakAfter fixture.
    const BREAK_AFTER_GAME: SeededGame = {
      quizId: 3,
      gameSessionId: 103,
      joinCode: 'ZZZZZZ',
      rounds: [
        {
          id: 14,
          title: 'Round A',
          breakAfter: true,
          questions: [
            {
              id: 26,
              type: 'free_text',
              prompt: 'QA1',
              points: 1,
              answer: 'A1',
            },
          ],
        },
      ],
    };
    const localSeedService = {
      seed: jest.fn().mockResolvedValue(BREAK_AFTER_GAME),
      loadGame: jest.fn().mockResolvedValue(BREAK_AFTER_GAME),
      createSession: jest
        .fn()
        .mockResolvedValue({ gameSessionId: 103, joinCode: 'ZZZZZZ' }),
    };
    const localGameState = new GameStateService(
      asSeedService(localSeedService),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
    );
    await localGameState.onModuleInit();
    const localGateway = new GameGateway(
      localGameState,
      asTeamService(createFakeTeamService()),
      asAnswerService(createFakeAnswerService()),
      asBonusService(createFakeBonusService()),
      asSessionService(createFakeSessionService()),
      createFakeOrm(),
    );
    localGateway.server = asServer(createMockServer());

    jest.useFakeTimers();
    try {
      const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
        token: TEST_SESSION_TOKEN,
      });
      await localGateway.handleConnection(asSocket(admin));
      await localGateway.handleAdminAction(asSocket(admin), {
        action: 'START_QUIZ',
      });
      await localGateway.handleAdminAction(asSocket(admin), {
        action: 'ADVANCE',
      }); // -> round_intro
      await localGateway.handleAdminAction(asSocket(admin), {
        action: 'ADVANCE',
      }); // -> question_open (last question of a breakAfter round)
      await localGateway.handleAdminAction(asSocket(admin), {
        action: 'ADVANCE',
      }); // -> locking (arms the timer)

      expect(jest.getTimerCount()).toBeGreaterThan(0);

      localGateway.onModuleDestroy();

      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
