import { SOCKET_ROOMS, sessionRoom } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — concurrent sessions: state machine progression isolation', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway();
  });

  it('advances two sessions through the state machine independently, with no shared progress', async () => {
    const adminA = await game.connectAdmin();
    await game.openFirstQuestion(adminA);
    expect((await game.snapshot()).progress.status).toBe('question_open');

    // Session B is created directly through the module (mirroring what
    // POST /sessions does) while A already has its question open.
    const { joinCode: joinCodeB } = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );
    const adminB = await game.connectAdmin(joinCodeB);

    // Creating B must not touch A's already-open question.
    expect((await game.snapshot()).progress.status).toBe('question_open');
    expect((await game.snapshot(joinCodeB)).progress.status).toBe('lobby');

    game.clearEmits();
    for (const action of ['START_QUIZ', 'ADVANCE', 'ADVANCE'] as const) {
      await game.gateway.handleAdminAction(asSocket(adminB), { action });
    }

    const snapshotA = await game.snapshot();
    const snapshotB = await game.snapshot(joinCodeB);
    expect(snapshotA.progress.status).toBe('question_open');
    expect(snapshotB.progress.status).toBe('question_open');
    expect(snapshotA.joinCode).toBe(game.joinCode);
    expect(snapshotB.joinCode).toBe(joinCodeB);

    // B's actions must only have broadcast to B's rooms.
    const emittedRooms = game.roomEmits().flatMap(({ rooms }) => rooms);
    expect(emittedRooms).toContain(
      sessionRoom(joinCodeB, SOCKET_ROOMS.DISPLAY),
    );
    expect(emittedRooms).not.toContain(
      sessionRoom(game.joinCode, SOCKET_ROOMS.DISPLAY),
    );
  });
});
