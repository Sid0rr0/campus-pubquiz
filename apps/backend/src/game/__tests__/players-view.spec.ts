import {
  SOCKET_ROOMS,
  type GameAction,
  type PhoneScreen,
} from '@campus-pubquiz/types';
import {
  TWO_ROUND_QUIZ,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('Screen projection — the players view', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  function playersView() {
    return game.gameState.getView(game.joinCode, SOCKET_ROOMS.PLAYERS);
  }

  describe('a two-round quiz, across a whole walk', () => {
    beforeEach(async () => {
      game = await harness.createGateway({ rounds: TWO_ROUND_QUIZ });
    });

    it('says when the block is answerable, and which screen the phone shows, across a whole walk', async () => {
      const [round1, round2] = game.rounds.map((round) => round.questionIds);
      const block = (
        onScreenQuestionId: number | null = null,
      ): PhoneScreen => ({
        kind: 'block',
        onScreenQuestionId,
      });
      const steps: [GameAction, boolean, PhoneScreen][] = [
        ['START_QUIZ', false, { kind: 'rules' }],
        ['ADVANCE', false, { kind: 'round_title', title: 'General Knowledge' }], // fresh round intro
        ['ADVANCE', true, block()], // r1q1
        ['ADVANCE', true, block()], // r1q2
        ['ADVANCE', true, block()], // round intro over questions already open
        ['ADVANCE', true, block()], // r2q1
        ['ADVANCE', true, block()], // r2q2
        ['ADVANCE', true, block()], // locking
        ['ADVANCE', false, block()], // break_intro
        ['ADVANCE', false, { kind: 'round_title', title: 'General Knowledge' }], // reveal_intro
        ['ADVANCE', false, block(round1[0])],
        ['ADVANCE', false, block(round1[1])],
        ['ADVANCE', false, { kind: 'round_title', title: 'Landmarks & Flags' }], // reveal_intro for round 2
        ['ADVANCE', false, block(round2[0])],
      ];

      for (const [action, isAnswerable, phoneScreen] of steps) {
        await game.act(action);
        const view = playersView();
        expect({
          isAnswerable: view.isAnswerable,
          phoneScreen: view.phoneScreen,
        }).toEqual({ isAnswerable, phoneScreen });
      }
    });

    it('keeps answering open while the leaderboard covers a question teams already saw', async () => {
      await game.act('START_QUIZ');
      await game.act('ADVANCE'); // round intro
      await game.act('ADVANCE'); // r1q1

      await game.act('TOGGLE_LEADERBOARD');

      expect(playersView().isAnswerable).toBe(true);
    });

    it('keeps answering open when Previous steps back into a round intro whose questions are open', async () => {
      await game.act('START_QUIZ');
      for (let i = 0; i < 4; i += 1) await game.act('ADVANCE'); // -> round intro(1)
      await game.act('ADVANCE'); // r2q1

      await game.act('PREVIOUS');

      const view = playersView();
      expect(view.progress.status).toBe('round_intro');
      expect(view.isAnswerable).toBe(true);
    });

    it('tells the phone the round title card even while the leaderboard is up', async () => {
      await game.act('START_QUIZ');
      for (let i = 0; i < 9; i += 1) await game.act('ADVANCE'); // -> reveal_intro

      await game.act('TOGGLE_LEADERBOARD');

      expect(playersView().phoneScreen).toEqual({ kind: 'leaderboard' });
    });
  });

  describe('a kahoot round', () => {
    beforeEach(async () => {
      game = await harness.createGateway({ kahootMode: true });
      await game.act('START_QUIZ');
      await game.act('ADVANCE'); // round_intro
      await game.act('ADVANCE'); // q1
    });

    it('agrees with the answer-submission gate while a question is open, hidden behind the leaderboard, and shown', async () => {
      const gateAccepts = (questionId: number) =>
        game.gameState.isQuestionOpenForAnswering(game.joinCode, questionId);
      const { multipleChoice, freeText } = game.questionIds;

      expect(playersView().isAnswerable).toBe(true);
      expect(gateAccepts(multipleChoice)).toBe(true);

      await game.act('ADVANCE'); // locking
      await game.act('ADVANCE'); // reveal
      await game.act('ADVANCE'); // q2, opened behind the leaderboard
      expect(playersView().isAnswerable).toBe(false);
      expect(gateAccepts(freeText)).toBe(false);

      await game.act('TOGGLE_LEADERBOARD');
      expect(playersView().isAnswerable).toBe(true);
      expect(gateAccepts(freeText)).toBe(true);
    });

    it('follows the big screen to the revealed kahoot question', async () => {
      await game.act('ADVANCE'); // locking
      await game.act('ADVANCE'); // reveal

      expect(playersView().phoneScreen).toEqual({
        kind: 'block',
        onScreenQuestionId: game.questionIds.multipleChoice,
      });
    });
  });
});
