import { WsException } from '@nestjs/websockets';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type SocketRoomName,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { asSocket, createMockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — admin actions', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['The Quizzards'] });
  });

  function lastState(room: SocketRoomName): StateSnapshotPayload | undefined {
    return game
      .payloadsTo<StateSnapshotPayload>(room, SOCKET_EVENTS.STATE_UPDATED)
      .at(-1);
  }

  it('applies an admin action and broadcasts the updated snapshot to all three rooms', async () => {
    const admin = await game.connectAdmin();
    game.clearEmits();

    await game.gateway.handleAdminAction(asSocket(admin), {
      action: 'START_QUIZ',
    });

    for (const room of [
      SOCKET_ROOMS.DISPLAY,
      SOCKET_ROOMS.ADMIN,
      SOCKET_ROOMS.PLAYERS,
    ]) {
      expect(lastState(room)?.progress.status).toBe('rules');
    }
  });

  it('shows every joined team on the leaderboard at zero from the moment it joins, and keeps it there when toggled on', async () => {
    const [{ teamId }] = game.teams;
    const before = await game.snapshot();
    expect(before.leaderboard).toEqual([
      expect.objectContaining({ teamId, totalPoints: 0 }),
    ]);

    const toggled = await game.act('TOGGLE_LEADERBOARD');

    expect(toggled.progress.isLeaderboardVisible).toBe(true);
    expect(toggled.leaderboard).toEqual([
      expect.objectContaining({
        teamId,
        teamName: 'The Quizzards',
        totalPoints: 0,
        bonusPoints: 0,
      }),
    ]);
  });

  it('hides the leaderboard again when toggled off', async () => {
    await game.act('TOGGLE_LEADERBOARD'); // on

    const off = await game.act('TOGGLE_LEADERBOARD');

    expect(off.progress.isLeaderboardVisible).toBe(false);
  });

  it('toggles media fullscreen and broadcasts the updated snapshot', async () => {
    const snapshot = await game.act('TOGGLE_MEDIA_FULLSCREEN');

    expect(snapshot.progress.isMediaFullscreen).toBe(true);
  });

  it('replays media and broadcasts the bumped mediaReplayToken', async () => {
    const snapshot = await game.act('REPLAY_MEDIA');

    expect(snapshot.progress.mediaReplayToken).toBe(1);
  });

  it('rejects an admin action from a non-admin client without broadcasting', async () => {
    const display = createMockSocket(
      SOCKET_ROOMS.DISPLAY,
      {},
      'display-1',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(display));
    game.clearEmits();

    await expect(
      game.gateway.handleAdminAction(asSocket(display), {
        action: 'START_QUIZ',
      }),
    ).rejects.toThrow(WsException);
    expect(game.roomEmits()).toEqual([]);
  });

  it('propagates an illegal-transition error for an out-of-order admin action without broadcasting', async () => {
    const admin = await game.connectAdmin();
    game.clearEmits();

    // ADVANCE is illegal from lobby - quiz hasn't started yet
    await expect(
      game.gateway.handleAdminAction(asSocket(admin), { action: 'ADVANCE' }),
    ).rejects.toThrow(WsException);
    expect(game.roomEmits()).toEqual([]);
  });
});
