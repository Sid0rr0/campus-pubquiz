import {
  SOCKET_ROOMS,
  type DisplayStatePayload,
  type GameStatus,
} from '@campus-pubquiz/types';
import {
  setupRealStoreGatewayTest,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const MAX_ADVANCES = 40;

const TWO_ROUNDS: QuizRoundSpec[] = [
  {
    title: 'Music',
    questions: [{ type: 'free_text', prompt: 'Q1', answer: 'a', points: 1 }],
  },
  {
    title: 'Film',
    breakAfter: true,
    questions: [{ type: 'free_text', prompt: 'Q2', answer: 'b', points: 1 }],
  },
];

async function advanceUntilStatus(
  game: RealStoreGateway,
  status: GameStatus,
): Promise<void> {
  let snapshot = await game.snapshot();
  for (let i = 0; i < MAX_ADVANCES; i += 1) {
    if (snapshot.progress.status === status) return;
    snapshot = await game.act('ADVANCE');
  }
  throw new Error(`Never reached status "${status}"`);
}

describe('Screen projection — the big-screen feedback prompt flag', () => {
  const harness = setupRealStoreGatewayTest();

  function displayView(game: RealStoreGateway): DisplayStatePayload {
    return game.gameState.getView(game.joinCode, SOCKET_ROOMS.DISPLAY);
  }

  function createGame(collectFeedback: boolean): Promise<RealStoreGateway> {
    return harness.createGateway({
      teamNames: ['The Quizzards'],
      rounds: TWO_ROUNDS,
      settings: { collectFeedback },
    });
  }

  it.each([
    ['on', true],
    ['off', false],
  ])(
    'break_intro says whether to show the prompt when the setting is %s',
    async (_label, collectFeedback) => {
      const game = await createGame(collectFeedback);
      await game.act('START_QUIZ');
      await advanceUntilStatus(game, 'break_intro');

      expect(displayView(game).onAirScreen).toEqual({
        kind: 'break_intro',
        roundIndex: 1,
        isFeedbackPromptShown: collectFeedback,
      });
    },
  );

  it.each([
    ['on', true],
    ['off', false],
  ])(
    'ended says whether to show the prompt when the setting is %s',
    async (_label, collectFeedback) => {
      const game = await createGame(collectFeedback);
      await game.act('START_QUIZ');
      await game.act('END_QUIZ');

      expect(displayView(game).onAirScreen).toEqual({
        kind: 'ended',
        isFeedbackPromptShown: collectFeedback,
      });
    },
  );
});
