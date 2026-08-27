import {
  DEFAULT_SESSION_SETTINGS,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
} from '@campus-pubquiz/types';
import type { SeededGame } from '@/db/seed.types';
import { GameGateway } from '@/game/game.gateway';
import { GameStateService } from '@/game/state/game-state.service';
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
  asSocket,
  asServer,
  asSeedService,
  asGameProgressRepository,
  asTeamService,
  asAnswerService,
  asBonusService,
  asSessionService,
  type MockServer,
  createFakeShowdownService,
  asShowdownService,
} from './test-utils';

describe('GameGateway — question lock auto-advance timer', () => {
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
          {
            id: 27,
            type: 'free_text',
            prompt: 'QA2',
            points: 1,
            answer: 'A2',
          },
        ],
      },
    ],
    settings: DEFAULT_SESSION_SETTINGS,
  };

  async function createGatewayWithBreakAfterGame() {
    const localSeedService = {
      seed: jest.fn().mockResolvedValue(BREAK_AFTER_GAME),
      loadGame: jest.fn().mockResolvedValue(BREAK_AFTER_GAME),
      createSession: jest
        .fn()
        .mockResolvedValue({ gameSessionId: 103, joinCode: 'ZZZZZZ' }),
      updateSettings: jest.fn(),
    };
    const gameStateService = new GameStateService(
      asSeedService(localSeedService),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
      asShowdownService(createFakeShowdownService()),
    );
    await gameStateService.onModuleInit();
    const localGateway = new GameGateway(
      gameStateService,
      asTeamService(createFakeTeamService()),
      asAnswerService(createFakeAnswerService()),
      asBonusService(createFakeBonusService()),
      asSessionService(createFakeSessionService()),
      createFakeOrm(),
      asShowdownService(createFakeShowdownService()),
    );
    const localServer = createMockServer();
    localGateway.server = asServer(localServer);
    return { gateway: localGateway, server: localServer };
  }

  /** Opens the last question of the single breakAfter round (no lock yet — still just open). */
  async function openLastQuestion(
    localGateway: GameGateway,
    localServer: MockServer,
  ) {
    const admin = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: TEST_SESSION_TOKEN },
      'socket-1',
      'ZZZZZZ',
    );
    await localGateway.handleConnection(asSocket(admin));
    await localGateway.handleAdminAction(asSocket(admin), {
      action: 'START_QUIZ',
    });
    await localGateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    }); // -> round_intro(0)
    await localGateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    }); // -> qA1
    await localGateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    }); // -> qA2 (last question, breakAfter, still just open)
    localServer.to.mockClear();
    localServer.emit.mockClear();
    return admin;
  }

  /** Opens the last question, then advances into the locking countdown (lock gets armed). */
  async function enterLockingCountdown(
    localGateway: GameGateway,
    localServer: MockServer,
  ) {
    const admin = await openLastQuestion(localGateway, localServer);
    await localGateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    }); // -> locking, lock armed
    localServer.to.mockClear();
    localServer.emit.mockClear();
    return admin;
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not arm a lock merely from opening the last question of a breakAfter round', async () => {
    const { gateway: localGateway, server: localServer } =
      await createGatewayWithBreakAfterGame();
    await openLastQuestion(localGateway, localServer);

    await jest.advanceTimersByTimeAsync(60_000);

    expect(localServer.emit).not.toHaveBeenCalled();
  });

  it('auto-advances to break 60s after the admin starts the locking countdown, without further admin action', async () => {
    const { gateway: localGateway, server: localServer } =
      await createGatewayWithBreakAfterGame();
    await enterLockingCountdown(localGateway, localServer);

    await jest.advanceTimersByTimeAsync(60_000);

    expect(localServer.to).toHaveBeenCalledWith(
      sessionRoom('ZZZZZZ', SOCKET_ROOMS.DISPLAY),
    );
    expect(localServer.to).toHaveBeenCalledWith(
      sessionRoom('ZZZZZZ', SOCKET_ROOMS.ADMIN),
    );
    expect(localServer.to).toHaveBeenCalledWith(
      sessionRoom('ZZZZZZ', SOCKET_ROOMS.PLAYERS),
    );
    expect(localServer.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining resolves to `any` in @types/jest
        progress: expect.objectContaining({ status: 'break_intro' }),
      }),
    );
  });

  it('cancels the pending auto-lock when the admin advances manually before it fires', async () => {
    const { gateway: localGateway, server: localServer } =
      await createGatewayWithBreakAfterGame();
    const admin = await enterLockingCountdown(localGateway, localServer);

    await localGateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    }); // manual advance -> break
    localServer.to.mockClear();
    localServer.emit.mockClear();

    await jest.advanceTimersByTimeAsync(60_000);

    expect(localServer.emit).not.toHaveBeenCalled();
  });

  it('cancels the pending auto-lock when the admin steps back from locking to the question', async () => {
    const { gateway: localGateway, server: localServer } =
      await createGatewayWithBreakAfterGame();
    const admin = await enterLockingCountdown(localGateway, localServer);

    await localGateway.handleAdminAction(asSocket(admin), {
      action: 'PREVIOUS',
    }); // manual step back -> question_open
    localServer.to.mockClear();
    localServer.emit.mockClear();

    await jest.advanceTimersByTimeAsync(60_000);

    expect(localServer.emit).not.toHaveBeenCalled();
  });

  it('does not arm a lock on a question that is not the last of a breakAfter round', async () => {
    const { gateway: localGateway, server: localServer } =
      await createGatewayWithBreakAfterGame();
    const admin = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: TEST_SESSION_TOKEN },
      'socket-1',
      'ZZZZZZ',
    );
    await localGateway.handleConnection(asSocket(admin));
    await localGateway.handleAdminAction(asSocket(admin), {
      action: 'START_QUIZ',
    });
    await localGateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    }); // -> round_intro(0)
    await localGateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    }); // -> qA1 (first of two, not last)
    localServer.to.mockClear();
    localServer.emit.mockClear();

    await jest.advanceTimersByTimeAsync(60_000);

    expect(localServer.emit).not.toHaveBeenCalled();
  });
});
