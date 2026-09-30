import { SOCKET_ROOMS, type GameAction } from '@campus-pubquiz/types';
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

    it('says when the block is answerable, and what the phone follows during reveal and title cards', async () => {
      const [round1, round2] = game.rounds.map((round) => round.questionIds);
      const none = { onScreenQuestionId: null, roundTitleCard: null };
      const steps: [
        GameAction,
        boolean,
        { onScreenQuestionId: number | null; roundTitleCard: string | null },
      ][] = [
        ['START_QUIZ', false, none], // rules
        ['ADVANCE', false, none], // fresh round intro: nothing open yet
        ['ADVANCE', true, none], // r1q1
        ['ADVANCE', true, none], // r1q2
        ['ADVANCE', true, none], // round intro over questions already open
        ['ADVANCE', true, none], // r2q1
        ['ADVANCE', true, none], // r2q2
        ['ADVANCE', true, none], // locking
        ['ADVANCE', false, none], // break_intro
        [
          'ADVANCE',
          false,
          { onScreenQuestionId: null, roundTitleCard: 'General Knowledge' },
        ], // reveal_intro
        ['ADVANCE', false, { ...none, onScreenQuestionId: round1[0] }],
        ['ADVANCE', false, { ...none, onScreenQuestionId: round1[1] }],
        [
          'ADVANCE',
          false,
          { onScreenQuestionId: null, roundTitleCard: 'Landmarks & Flags' },
        ], // reveal_intro for round 2
        ['ADVANCE', false, { ...none, onScreenQuestionId: round2[0] }],
      ];

      for (const [action, isAnswerable, screenFields] of steps) {
        await game.act(action);
        const view = playersView();
        expect({
          isAnswerable: view.isAnswerable,
          onScreenQuestionId: view.onScreenQuestionId,
          roundTitleCard: view.roundTitleCard,
        }).toEqual({ isAnswerable, ...screenFields });
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

      expect(playersView().roundTitleCard).toBe('General Knowledge');
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

      expect(playersView().onScreenQuestionId).toBe(
        game.questionIds.multipleChoice,
      );
    });
  });
});
