import { SOCKET_EVENTS } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import { SessionBroadcaster } from '@/game/socket/session-broadcaster';
import { BROADCAST_STATE_OUTCOME } from '@/game/state/session-outcome';
import { setupRealStoreGatewayTest } from '@/game/__tests__/real-store-test-utils';

describe('SessionBroadcaster', () => {
  const harness = setupRealStoreGatewayTest();

  it('throws a clear error and emits nothing when delivering before attach', async () => {
    const game = await harness.createGateway();
    const unattached = new SessionBroadcaster(
      game.gameState,
      game.answerService,
      game.bonusService,
      game.orm,
    );
    game.clearEmits();

    await expect(
      unattached.deliver(game.joinCode, BROADCAST_STATE_OUTCOME),
    ).rejects.toThrow(/attach/i);

    expect(game.roomEmits()).toEqual([]);
  });

  it.each([
    [
      'notifySessionClosed',
      (b: SessionBroadcaster) => b.notifySessionClosed('ABCDEF'),
    ],
    ['disconnectUser', (b: SessionBroadcaster) => b.disconnectUser(1)],
  ])(
    '%s throws a clear error when called before attach',
    async (_name, call) => {
      const game = await harness.createGateway();
      const unattached = new SessionBroadcaster(
        game.gameState,
        game.answerService,
        game.bonusService,
        game.orm,
      );

      expect(() => call(unattached)).toThrow(/attach/i);
    },
  );

  it('delivers an outcome with no sender without replies but with everything else in the usual order', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const admin = await game.connectAdmin();
    const [{ socket, teamId }] = game.teams;
    await game.openFirstQuestion(admin);
    const outcome = await game.inRequestContext(() =>
      game.gameState.submitAnswer(
        game.joinCode,
        { questionId: game.questionIds.multipleChoice, teamId, value: 'Paris' },
        socket.id,
      ),
    );
    expect(outcome.replies.length).toBeGreaterThan(0);
    game.clearEmits();

    await game.inRequestContext(() =>
      game.broadcaster.deliver(game.joinCode, outcome),
    );

    expect(socket.emit).not.toHaveBeenCalledWith(
      SOCKET_EVENTS.ANSWER_RECEIVED,
      expect.anything(),
    );
    expect(game.roomEmits().map((emit) => emit.event)).toEqual([
      SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED,
      SOCKET_EVENTS.STATE_UPDATED,
      SOCKET_EVENTS.STATE_UPDATED,
      SOCKET_EVENTS.STATE_UPDATED,
      SOCKET_EVENTS.ANSWERS_UPDATED,
      SOCKET_EVENTS.TEAM_ROOM_READY_SYNCED,
    ]);
  });

  it('broadcastState sends the same per-room snapshots as an admin action that only rebroadcasts', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const admin = await game.connectAdmin();
    await game.openFirstQuestion(admin);
    game.clearEmits();
    await game.gateway.handleAdminAction(asSocket(admin), {
      action: 'TOGGLE_LEADERBOARD',
    });
    const viaAdminAction = game.roomEmits();
    await game.gateway.handleAdminAction(asSocket(admin), {
      action: 'TOGGLE_LEADERBOARD',
    });
    game.clearEmits();

    await game.inRequestContext(() =>
      game.broadcaster.broadcastState(game.joinCode),
    );

    expect(game.roomEmits().map(({ rooms, event }) => [rooms, event])).toEqual(
      viaAdminAction.map(({ rooms, event }) => [rooms, event]),
    );
  });
});
