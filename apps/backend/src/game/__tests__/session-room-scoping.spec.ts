import {
  DEFAULT_SESSION_SETTINGS,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
} from '@campus-pubquiz/types';
import { asSocket, createMockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const LOCK_GRACE_SECONDS = 1;
const PAST_LOCK_GRACE_MS = 1_800;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('GameGateway — session room scoping', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway();
  });

  /** Every room an emit since the last clearEmits() was addressed to. */
  function emittedRooms(): string[] {
    return game.roomEmits().flatMap(({ rooms }) => rooms);
  }

  async function createOtherSession(
    settings = DEFAULT_SESSION_SETTINGS,
  ): Promise<string> {
    const { joinCode } = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId, settings),
    );
    return joinCode;
  }

  it('joins a connecting client to the session named by an explicit code', async () => {
    const display = createMockSocket(
      SOCKET_ROOMS.DISPLAY,
      {},
      'socket-1',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(display));

    expect(display.join).toHaveBeenCalledWith(
      sessionRoom(game.joinCode, SOCKET_ROOMS.DISPLAY),
    );
    expect(display.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_SYNC,
      expect.objectContaining({ joinCode: game.joinCode }),
    );
  });

  it('rejects a connection whose code does not resolve to a known session', async () => {
    const display = createMockSocket(
      SOCKET_ROOMS.DISPLAY,
      {},
      'socket-1',
      'NOSUCHCODE',
    );
    await game.gateway.handleConnection(asSocket(display));

    expect(display.join).not.toHaveBeenCalled();
    expect(display.disconnect).toHaveBeenCalled();
  });

  it("keeps two sessions fully isolated: an admin action in one only broadcasts to that session's rooms", async () => {
    // Session A is the seeded one. Session B is created directly through the
    // module (mirroring what POST /sessions does), each with its own admin.
    const joinCodeB = await createOtherSession();
    const adminForA = await game.connectAdmin();
    const adminForB = await game.connectAdmin(joinCodeB);
    const adminRoomA = sessionRoom(game.joinCode, SOCKET_ROOMS.ADMIN);
    const adminRoomB = sessionRoom(joinCodeB, SOCKET_ROOMS.ADMIN);

    game.clearEmits();
    await game.gateway.handleAdminAction(asSocket(adminForA), {
      action: 'START_QUIZ',
    });

    expect(emittedRooms()).toContain(adminRoomA);
    expect(emittedRooms()).not.toContain(adminRoomB);

    game.clearEmits();
    await game.gateway.handleAdminAction(asSocket(adminForB), {
      action: 'START_QUIZ',
    });

    expect(emittedRooms()).toContain(adminRoomB);
    expect(emittedRooms()).not.toContain(adminRoomA);
  });

  it("clears the connection roster of the disconnecting socket's own session, not the admin's other session", async () => {
    const joinCodeB = await createOtherSession();
    await game.connectAdmin(joinCodeB);
    const { socket: playerInA } = await game.joinTeam('The Quizzards');

    game.clearEmits();
    await game.gateway.handleDisconnect(asSocket(playerInA));

    expect(emittedRooms()).toContain(
      sessionRoom(game.joinCode, SOCKET_ROOMS.DISPLAY),
    );
    expect(emittedRooms()).not.toContain(
      sessionRoom(joinCodeB, SOCKET_ROOMS.DISPLAY),
    );
  });

  it('clears every armed question-lock timer for every session on module destroy', async () => {
    // The quiz's round has breakAfter: true, so its last question arms a lock
    // timer once it locks.
    const quick = {
      ...DEFAULT_SESSION_SETTINGS,
      lockGraceSeconds: LOCK_GRACE_SECONDS,
    };
    const armed = await harness.createGateway({
      joinCode: 'ARMED1',
      settings: quick,
      rounds: [
        {
          title: 'Round A',
          breakAfter: true,
          questions: [{ type: 'free_text', prompt: 'QA1', answer: 'A1' }],
        },
      ],
    });
    const { joinCode: joinCodeB } = await armed.inRequestContext(() =>
      armed.gameState.createSession(armed.quizId, quick),
    );

    for (const joinCode of [armed.joinCode, joinCodeB]) {
      const admin = await armed.connectAdmin(joinCode);
      for (const action of [
        'START_QUIZ',
        'ADVANCE', // -> round_intro
        'ADVANCE', // -> question_open (last question of a breakAfter round)
        'ADVANCE', // -> locking (arms the timer)
      ] as const) {
        await armed.gateway.handleAdminAction(asSocket(admin), { action });
      }
      expect((await armed.snapshot(joinCode)).progress.status).toBe('locking');
    }

    armed.gateway.onModuleDestroy();
    await delay(PAST_LOCK_GRACE_MS);

    // Had either timer survived, the 1s grace would have advanced its session.
    for (const joinCode of [armed.joinCode, joinCodeB]) {
      expect((await armed.snapshot(joinCode)).progress.status).toBe('locking');
    }
  });
});
