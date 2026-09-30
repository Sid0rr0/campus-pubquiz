import { WsException } from '@nestjs/websockets';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — kahoot question hidden behind the leaderboard', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({
      kahootMode: true,
      teamNames: ['The Quizzards'],
    });
    // Drives q0 through question_open -> locking -> reveal -> the next
    // question, which opens hidden behind the leaderboard (see advanceFromReveal).
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro
    await game.act('ADVANCE'); // -> question_open q0
    await game.act('ADVANCE'); // -> locking
    await game.act('ADVANCE'); // -> reveal
    const hidden = await game.act('ADVANCE'); // -> question_open q1, isLeaderboardVisible: true
    expect(hidden.progress.isLeaderboardVisible).toBe(true);
  });

  function submitToSecondQuestion() {
    const [{ socket, teamId }] = game.teams;
    return game.gateway.handleSubmitAnswer(asSocket(socket), {
      questionId: game.questionIds.freeText,
      teamId,
      value: 'Jupiter',
    });
  }

  function storedAnswers() {
    return game.inRequestContext(() =>
      game.answerService.listForQuestion(
        game.gameSessionId,
        game.questionIds.freeText,
      ),
    );
  }

  it('rejects SUBMIT_ANSWER for a kahoot question still hidden behind the leaderboard', async () => {
    await expect(submitToSecondQuestion()).rejects.toThrow(WsException);

    expect(await storedAnswers()).toEqual([]);
  });

  it('accepts SUBMIT_ANSWER for that question once TOGGLE_LEADERBOARD reveals it', async () => {
    await game.act('TOGGLE_LEADERBOARD');

    await submitToSecondQuestion();

    expect(await storedAnswers()).toEqual([
      expect.objectContaining({ teamName: 'The Quizzards', value: 'Jupiter' }),
    ]);
  });
});
