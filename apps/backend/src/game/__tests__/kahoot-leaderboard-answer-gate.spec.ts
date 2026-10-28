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
    await expect(submitToSecondQuestion()).resolves.toMatchObject({
      success: false,
    });

    expect(await storedAnswers()).toEqual([]);
  });

  it('still refuses an answer to a revealed kahoot question after a step back onto it and a restart', async () => {
    await game.act('TOGGLE_LEADERBOARD');
    await game.act('PREVIOUS'); // -> reveal q0 (its reveal aired earlier)
    const back = await game.act('PREVIOUS'); // -> locking q0
    expect(back.progress).toMatchObject({
      status: 'locking',
      questionIndex: 0,
    });
    // At locking q0 the position alone does not mark q0 revealed, so only the
    // persisted revealedKahootQuestionIds can keep the gate shut.
    const restarted = await game.restart();
    const [{ socket, teamId, teamToken }] = game.teams;
    // A restart drops sockets and connected teams: the phone rejoins by token.
    await restarted.gateway.handleJoinPlayers(asSocket(socket), {
      teamName: 'The Quizzards',
      teamToken,
      joinCode: game.joinCode,
    });

    const result = await restarted.gateway.handleSubmitAnswer(
      asSocket(socket),
      {
        questionId: game.questionIds.multipleChoice,
        teamId,
        value: 'Paris',
      },
    );

    expect(result).toMatchObject({ success: false });
  });

  it('accepts SUBMIT_ANSWER for that question once TOGGLE_LEADERBOARD reveals it', async () => {
    await game.act('TOGGLE_LEADERBOARD');

    await submitToSecondQuestion();

    expect(await storedAnswers()).toEqual([
      expect.objectContaining({ teamName: 'The Quizzards', value: 'Jupiter' }),
    ]);
  });
});
