import { SOCKET_EVENTS } from '@campus-pubquiz/types';
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
      game.orm,
    );
    game.clearEmits();

    await expect(
      unattached.deliver(game.joinCode, BROADCAST_STATE_OUTCOME),
    ).rejects.toThrow(/attach/i);

    expect(game.roomEmits()).toEqual([]);
  });

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
    ]);
  });
});
