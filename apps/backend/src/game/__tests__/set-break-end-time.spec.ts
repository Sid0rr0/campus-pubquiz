import { WsException } from '@nestjs/websockets';
import {
  DEFAULT_SESSION_SETTINGS,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
} from '@campus-pubquiz/types';
import type { SeededGame } from '@/db/seed.types';
import { GameStateService } from '@/game/state/game-state.service';
import type { GameGateway } from '@/game/game.gateway';
import {
  TEST_SESSION_TOKEN,
  createFakeAnswerService,
  createFakeGameProgressRepository,
  createFakeOrm,
  createMockSocket,
  createTestGateway,
  asSeedService,
  asGameProgressRepository,
  asAnswerService,
  asSocket,
  type MockServer,
} from './test-utils';

describe('GameGateway — set break end time', () => {
  let gateway: GameGateway;
  let server: MockServer;

  beforeEach(async () => {
    ({ gateway, server } = await createTestGateway());
  });

  it('sets breakEndsAt and broadcasts it to every room', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleSetBreakEndTime(asSocket(admin), {
      breakEndsAt: 1_700_000_000_000,
    });

    expect(server.to).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.DISPLAY),
    );
    expect(server.to).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.ADMIN),
    );
    expect(server.to).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.PLAYERS),
    );
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({ breakEndsAt: 1_700_000_000_000 }),
    );
  });

  it('clears breakEndsAt when sent null', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));
    await gateway.handleSetBreakEndTime(asSocket(admin), {
      breakEndsAt: 1_700_000_000_000,
    });

    await gateway.handleSetBreakEndTime(asSocket(admin), {
      breakEndsAt: null,
    });

    expect(server.emit).toHaveBeenLastCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({ breakEndsAt: null }),
    );
  });

  it('rejects SET_BREAK_END_TIME from a non-admin client', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await expect(
      gateway.handleSetBreakEndTime(asSocket(player), {
        breakEndsAt: 1_700_000_000_000,
      }),
    ).rejects.toThrow(WsException);
  });

  it('rejects a non-numeric, non-null breakEndsAt payload', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));

    await expect(
      gateway.handleSetBreakEndTime(asSocket(admin), {
        breakEndsAt: 'soon',
      }),
    ).rejects.toThrow(WsException);
  });
});

// A quiz with two separate breakAfter rounds (unlike the shared one-block
// fixtures) so this suite can drive the session through two full break
// cycles — the only way to exercise the "a *second* fresh break clears a
// leftover end-time from the first" reset path in GameStateService.applyAction.
const TWO_BREAK_SEEDED_GAME: SeededGame = {
  quizId: 1,
  gameSessionId: 101,
  joinCode: 'ABCDEF',
  rounds: [
    {
      id: 11,
      title: 'Round 1',
      breakAfter: true,
      questions: [
        { id: 21, type: 'free_text', prompt: 'Q1', points: 1, answer: 'A1' },
      ],
    },
    {
      id: 12,
      title: 'Round 2',
      breakAfter: true,
      questions: [
        { id: 22, type: 'free_text', prompt: 'Q2', points: 1, answer: 'A2' },
      ],
    },
  ],
  settings: DEFAULT_SESSION_SETTINGS,
};

describe('GameStateService — breakEndsAt reset on a fresh break', () => {
  let service: GameStateService;
  const joinCode = 'ABCDEF';

  beforeEach(async () => {
    service = new GameStateService(
      asSeedService({
        seed: jest.fn().mockResolvedValue(TWO_BREAK_SEEDED_GAME),
        loadGame: jest.fn().mockResolvedValue(TWO_BREAK_SEEDED_GAME),
        createSession: jest
          .fn()
          .mockResolvedValue({ gameSessionId: 101, joinCode }),
        updateSettings: jest.fn().mockResolvedValue(undefined),
      }),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
    );
    await service.onModuleInit();
  });

  it('carries a set end-time through the same break, then clears it once a second break starts fresh', async () => {
    await service.applyAction(joinCode, 'START_QUIZ'); // -> rules
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1 (question_open)
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking (last q, breakAfter)
    const firstBreak = await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro
    expect(firstBreak.progress.status).toBe('break_intro');
    expect(firstBreak.breakEndsAt).toBeNull();

    service.setBreakEndTime(joinCode, 555);
    expect(service.getSnapshot(joinCode).breakEndsAt).toBe(555);

    const stillInBreak = await service.applyAction(joinCode, 'PREVIOUS'); // -> break (same cycle)
    expect(stillInBreak.progress.status).toBe('break');
    expect(stillInBreak.breakEndsAt).toBe(555);

    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal_intro
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1 (question_open)
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    const secondBreak = await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro (fresh)

    expect(secondBreak.progress.status).toBe('break_intro');
    expect(secondBreak.breakEndsAt).toBeNull();
  });
});
