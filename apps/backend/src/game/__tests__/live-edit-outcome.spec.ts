import { asSocket } from '@/game/__tests__/test-utils';
import { setupRealStoreGatewayTest } from '@/game/__tests__/real-store-test-utils';

describe('Live edit module — what a save reports', () => {
  const harness = setupRealStoreGatewayTest();

  it('knows a quiz has a running session only once its quiz has started', async () => {
    const game = await harness.createGateway({ teamNames: ['A'] });
    expect(game.liveEdit.hasLiveSession(game.quizId)).toBe(false);
    expect(game.liveEdit.getFrontier(game.quizId)).toBeNull();

    await game.act('START_QUIZ');

    expect(game.liveEdit.hasLiveSession(game.quizId)).toBe(true);
    expect(game.liveEdit.getFrontier(game.quizId)).not.toBeNull();
  });

  it('rethrows a failed delivery after a save that landed', async () => {
    const game = await harness.createGateway({ teamNames: ['A'] });
    await game.act('START_QUIZ');
    jest
      .spyOn(game.broadcaster, 'deliver')
      .mockRejectedValue(new Error('socket down'));

    await expect(game.saveQuizEdit()).rejects.toThrow('socket down');
  });

  it('syncs only the connected teams that answered a re-scored question', async () => {
    const game = await harness.createGateway({
      teamNames: ['Answered', 'Silent'],
    });
    const [answered] = game.teams;
    await game.act('START_QUIZ');
    await game.act('ADVANCE');
    await game.act('ADVANCE');
    await game.act('ADVANCE');
    await game.gateway.handleSubmitAnswer(asSocket(answered.socket), {
      questionId: game.questionIds.freeText,
      teamId: answered.teamId,
      value: 'Saturn',
    });
    const deliver = jest.spyOn(game.broadcaster, 'deliver');

    await game.saveAnswerKeyFix(game.questionIds.freeText, {
      answer: 'Saturn',
    });

    const [[, outcome]] = deliver.mock.calls;
    expect(outcome.answerListQuestionIds).toEqual([game.questionIds.freeText]);
    expect(outcome.teamSyncs).toEqual([
      { teamId: answered.teamId, socketId: answered.socket.id },
    ]);
  });
});
