import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { createMockSocket, asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const HIDDEN_PROMPT = 'Largest planet?';

describe('GameGateway — per-room state delivery with a hidden kahoot question', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({ kahootMode: true });
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro
    await game.act('ADVANCE'); // -> question_open q0
    await game.act('ADVANCE'); // -> locking
    await game.act('ADVANCE'); // -> reveal
    game.clearEmits();
    await game.act('ADVANCE'); // -> question_open q1 behind the leaderboard
  });

  function lastStateUpdatedTo(room: 'display' | 'admin' | 'players'): string {
    const payloads = game.payloadsTo<StateSnapshotPayload>(
      room,
      SOCKET_EVENTS.STATE_UPDATED,
    );
    return JSON.stringify(payloads[payloads.length - 1]);
  }

  async function connectDisplay() {
    const display = createMockSocket(
      SOCKET_ROOMS.DISPLAY,
      {},
      'display-x',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(display));
    return display;
  }

  async function stateSyncFor(room: 'display' | 'admin' | 'players') {
    const socket =
      room === SOCKET_ROOMS.ADMIN
        ? await game.connectAdmin()
        : room === SOCKET_ROOMS.PLAYERS
          ? await game.connectPlayer()
          : await connectDisplay();
    const syncs = socket.emit.mock.calls
      .filter(([event]) => event === SOCKET_EVENTS.STATE_SYNC)
      .map(([, payload]) => payload as StateSnapshotPayload);
    return JSON.stringify(syncs[0]);
  }

  it('sends the players room a STATE_UPDATED without the hidden prompt, and display and admin one with it', () => {
    expect(lastStateUpdatedTo('players')).not.toContain(HIDDEN_PROMPT);
    expect(lastStateUpdatedTo('display')).toContain(HIDDEN_PROMPT);
    expect(lastStateUpdatedTo('admin')).toContain(HIDDEN_PROMPT);
  });

  it('resyncs a connecting players socket without the hidden prompt, and display and admin sockets with it', async () => {
    expect(await stateSyncFor('players')).not.toContain(HIDDEN_PROMPT);
    expect(await stateSyncFor('display')).toContain(HIDDEN_PROMPT);
    expect(await stateSyncFor('admin')).toContain(HIDDEN_PROMPT);
  });

  it('hands a reconnecting players socket its own view, then the question once the board is dismissed', async () => {
    await game.act('TOGGLE_LEADERBOARD');

    expect(await stateSyncFor('players')).toContain(HIDDEN_PROMPT);
  });
});
