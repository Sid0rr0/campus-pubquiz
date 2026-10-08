import {
  rejectNthCall,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';
import { asSocket } from '@/game/__tests__/test-utils';
import { BROADCAST_STATE_OUTCOME } from '@/game/state/session-outcome';

describe('Live edit module — a failing delivery', () => {
  const harness = setupRealStoreGatewayTest();
  let first: RealStoreGateway;

  beforeEach(async () => {
    first = await harness.createGateway({
      rounds: [
        {
          title: 'Round A',
          breakAfter: true,
          questions: [
            { type: 'free_text', prompt: 'Q1', answer: 'A1' },
            { type: 'free_text', prompt: 'Q2', answer: 'A2' },
          ],
        },
      ],
    });
    const created = await first.inRequestContext(() =>
      first.gameState.createSession(first.quizId),
    );
    const secondAdmin = await first.connectAdmin(created.joinCode);
    // Both sessions leave the lobby, so both are live on the quiz.
    await first.act('START_QUIZ');
    await first.gateway.handleAdminAction(asSocket(secondAdmin), {
      action: 'START_QUIZ',
    });
  });

  it('does not mask the error that failed the save, and still delivers what landed', async () => {
    const reloadFailure = new Error('second reload failed');
    // The first session reloads for real, the second one's reload rejects.
    rejectNthCall(first.seedService, 'loadGame', reloadFailure, 1);
    const deliver = jest
      .spyOn(first.gateway, 'deliverSessionOutcome')
      .mockRejectedValue(new Error('socket down'));

    await expect(first.saveQuizEdit()).rejects.toBe(reloadFailure);

    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith(
      first.joinCode,
      BROADCAST_STATE_OUTCOME,
    );
  });
});
