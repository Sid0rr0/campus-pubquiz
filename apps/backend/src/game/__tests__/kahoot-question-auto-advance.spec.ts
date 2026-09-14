import {
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
  KAHOOT_SEEDED_GAME,
  createFakeShowdownService,
  asShowdownService,
} from './test-utils';

const KAHOOT_TIMER_SECONDS = 30;

describe('GameGateway — kahoot question auto-advance timer', () => {
  function timedKahootGame(
    kahootQuestionTimerSeconds: number | null,
  ): SeededGame {
    return {
      ...KAHOOT_SEEDED_GAME,
      settings: {
        ...KAHOOT_SEEDED_GAME.settings,
        kahootQuestionTimerSeconds,
      },
    };
  }

  async function createGatewayWithKahootGame(
    kahootQuestionTimerSeconds: number | null,
  ) {
    const game = timedKahootGame(kahootQuestionTimerSeconds);
    const localSeedService = {
      seed: jest.fn().mockResolvedValue(game),
      loadGame: jest.fn().mockResolvedValue(game),
      createSession: jest
        .fn()
        .mockResolvedValue({ gameSessionId: 103, joinCode: 'KAHOOT' }),
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

  /** Opens the first kahoot question (question_open q0, timer armed if configured). */
  async function openKahootQuestion(
    localGateway: GameGateway,
    localServer: MockServer,
  ) {
    const admin = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: TEST_SESSION_TOKEN },
      'socket-1',
      'KAHOOT',
    );
    await localGateway.handleConnection(asSocket(admin));
    await localGateway.handleAdminAction(asSocket(admin), {
      action: 'START_QUIZ',
    });
    await localGateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    }); // -> round_intro
    await localGateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    }); // -> question_open q0
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

  it('auto-advances question_open to locking with no admin action once the timer elapses', async () => {
    const { gateway: localGateway, server: localServer } =
      await createGatewayWithKahootGame(KAHOOT_TIMER_SECONDS);
    await openKahootQuestion(localGateway, localServer);

    await jest.advanceTimersByTimeAsync(KAHOOT_TIMER_SECONDS * 1000);

    expect(localServer.to).toHaveBeenCalledWith(
      sessionRoom('KAHOOT', SOCKET_ROOMS.DISPLAY),
    );
    expect(localServer.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining resolves to `any` in @types/jest
        progress: expect.objectContaining({ status: 'locking' }),
      }),
    );
  });

  it('does not arm a timer when kahootQuestionTimerSeconds is null', async () => {
    const { gateway: localGateway, server: localServer } =
      await createGatewayWithKahootGame(null);
    await openKahootQuestion(localGateway, localServer);

    await jest.advanceTimersByTimeAsync(60_000);

    expect(localServer.emit).not.toHaveBeenCalled();
  });

  it('cancels the pending auto-advance when the admin acts manually before it fires', async () => {
    const { gateway: localGateway, server: localServer } =
      await createGatewayWithKahootGame(KAHOOT_TIMER_SECONDS);
    const admin = await openKahootQuestion(localGateway, localServer);

    await localGateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    }); // manual advance -> locking
    localServer.to.mockClear();
    localServer.emit.mockClear();

    await jest.advanceTimersByTimeAsync(KAHOOT_TIMER_SECONDS * 1000);

    expect(localServer.emit).not.toHaveBeenCalled();
  });

  it('arms the existing lock timer normally after auto-advancing into locking', async () => {
    const { gateway: localGateway, server: localServer } =
      await createGatewayWithKahootGame(KAHOOT_TIMER_SECONDS);
    await openKahootQuestion(localGateway, localServer);

    await jest.advanceTimersByTimeAsync(KAHOOT_TIMER_SECONDS * 1000); // auto-advance -> locking
    localServer.to.mockClear();
    localServer.emit.mockClear();

    await jest.advanceTimersByTimeAsync(60_000); // default lockGraceSeconds

    expect(localServer.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining resolves to `any` in @types/jest
        progress: expect.objectContaining({ status: 'reveal' }),
      }),
    );
  });
});
