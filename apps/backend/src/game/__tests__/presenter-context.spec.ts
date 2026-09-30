import { SOCKET_ROOMS, type OnAirScreen } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  TWO_ROUND_QUIZ,
  TWO_ROUND_QUIZ_HOST_NOTE,
  setupRealStoreGatewayTest,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const TWO_BLOCK_QUIZ: QuizRoundSpec[] = [
  {
    title: 'Music',
    breakAfter: true,
    questions: [
      { type: 'free_text', prompt: 'Band?', answer: 'ABBA', points: 1 },
    ],
  },
  {
    title: 'Sport',
    breakAfter: true,
    questions: [
      { type: 'free_text', prompt: 'Sport?', answer: 'Golf', points: 1 },
    ],
  },
];

describe('GameStateService — getPresenterContext', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  async function advance(times: number): Promise<void> {
    for (let i = 0; i < times; i += 1) {
      await game.act('ADVANCE');
    }
  }

  /** Has the team answer the first question correctly, so it is on the board for the leaderboard screens. */
  async function answerFirstQuestion(answer: string): Promise<void> {
    const { socket, teamId } = game.teams[0];
    await game.gateway.handleSubmitAnswer(asSocket(socket), {
      questionId: game.rounds[0].questionIds[0],
      teamId,
      value: answer,
    });
  }

  function screens() {
    const { currentScreen, nextScreen } = game.gameState.getPresenterContext(
      game.joinCode,
    );
    return {
      current: currentScreen.heading,
      next: nextScreen?.heading ?? null,
      nextBody: nextScreen?.body,
      nextQuestionId: nextScreen?.question?.id,
    };
  }

  describe('two-round, one-block quiz', () => {
    beforeEach(async () => {
      game = await harness.createGateway({
        rounds: TWO_ROUND_QUIZ,
        teamNames: ['The Quizzards'],
      });
    });

    it('previews the rules screen from the lobby', () => {
      expect(screens()).toMatchObject({ current: 'Lobby', next: 'Rules' });
    });

    it('returns notes for the open question and previews the next question with its answer', async () => {
      await game.act('START_QUIZ');
      await advance(2); // -> round_intro(0) -> r1q1

      const context = game.gameState.getPresenterContext(game.joinCode);
      expect(context.currentQuestionNotes).toBe(TWO_ROUND_QUIZ_HOST_NOTE);
      expect(context.currentScreen.heading).toBe('R1 Q1');
      expect(context.nextScreen?.question).toEqual(
        expect.objectContaining({
          id: game.rounds[0].questionIds[1],
          answer: 'Jupiter',
        }),
      );
    });

    it('walks every screen up to the break', async () => {
      await game.act('START_QUIZ');
      expect(screens()).toMatchObject({
        current: 'Rules',
        next: 'Round 1 title',
        nextBody: 'General Knowledge',
      });

      await advance(1);
      expect(screens()).toMatchObject({
        current: 'Round 1 title',
        next: 'R1 Q1',
        nextQuestionId: game.rounds[0].questionIds[0],
      });

      await advance(2); // -> r1q2, last question of a non-break round
      expect(screens()).toMatchObject({
        current: 'R1 Q2',
        next: 'Round 2 title',
        nextBody: 'Landmarks & Flags',
      });

      await advance(2); // -> round_intro(1) -> r2q1
      expect(screens()).toMatchObject({
        next: 'R2 Q2',
        nextQuestionId: game.rounds[1].questionIds[1],
      });

      await advance(1); // -> r2q2, last question before the break
      expect(screens()).toMatchObject({ next: 'Locking answers' });

      await advance(1); // -> locking
      expect(screens()).toMatchObject({
        current: 'Locking answers',
        next: 'Break 1',
        nextBody: 'After round 2',
      });
    });

    it('walks from the break through every reveal to the final leaderboard', async () => {
      await game.act('START_QUIZ');
      await advance(2); // -> round_intro(0) -> r1q1
      await answerFirstQuestion('Paris');
      await advance(6); // -> break_intro

      expect(screens()).toMatchObject({
        current: 'Break 1',
        next: 'Revealing · Round 1 title',
        nextBody: 'General Knowledge',
      });

      await advance(1); // -> reveal_intro(0)
      expect(screens()).toMatchObject({
        next: 'Revealing R1 Q1',
        nextBody: 'Capital of France? — Answer: Paris',
      });

      await advance(1); // -> reveal R1 Q1
      expect(screens()).toMatchObject({
        current: 'Revealing R1 Q1',
        next: 'Revealing R1 Q2',
      });

      await advance(1); // -> reveal R1 Q2, last of round 1
      expect(screens()).toMatchObject({
        next: 'Revealing · Round 2 title',
        nextBody: 'Landmarks & Flags',
      });

      await advance(3); // -> reveal_intro(2) -> R2 Q1 -> R2 Q2
      expect(screens()).toMatchObject({
        current: 'Revealing R2 Q2',
        next: 'Leaderboard',
        nextBody: 'Final standings',
      });

      await advance(1); // -> ended, final leaderboard
      expect(screens()).toMatchObject({
        current: 'Leaderboard',
        next: 'Leaderboard',
        nextBody: 'Next place (1 of 1)',
      });

      await game.act('REVEAL_NEXT_TEAM');
      expect(screens()).toMatchObject({ next: 'Quiz complete!' });
    });
  });

  describe('agreement with /display across a whole-quiz walk', () => {
    const HEADING_BY_SCREEN: Record<OnAirScreen['kind'], RegExp> = {
      lobby: /^Lobby$/,
      rules: /^Rules$/,
      round_overview: /^Round overview$/,
      round_title: /^Round \d+ title$/,
      question: /^R\d+ Q\d+$/,
      locking: /^Locking answers$/,
      break_intro: /^Break \d+$/,
      break_review: /^Break · Reviewing /,
      break_round_title: /^Break · Round \d+ title$/,
      reveal_intro: /^Revealing · Round \d+ title$/,
      reveal: /^Revealing R\d+ Q\d+$/,
      leaderboard: /^Leaderboard$/,
      ended: /^Quiz complete!$/,
      showdown: /^Showdown$/,
    };

    beforeEach(async () => {
      game = await harness.createGateway({
        rounds: TWO_ROUND_QUIZ,
        teamNames: ['The Quizzards'],
      });
    });

    it('describes exactly the screen /display has on air, and previews exactly the screen the next Advance puts there', async () => {
      await game.act('START_QUIZ');
      // Past the final reveal the leaderboard takes over and ADVANCE is no
      // longer the control, so the walk stops at the last reveal.
      for (let step = 0; step < 14; step += 1) {
        const before = game.gameState.getPresenterContext(game.joinCode);
        await game.act('ADVANCE');
        const after = game.gameState.getPresenterContext(game.joinCode);
        const { onAirScreen } = game.gameState.getView(
          game.joinCode,
          SOCKET_ROOMS.ADMIN,
        );

        expect(after.currentScreen.heading).toMatch(
          HEADING_BY_SCREEN[onAirScreen.kind],
        );
        expect(before.nextScreen?.heading).toBe(after.currentScreen.heading);
      }
    });
  });

  describe('two-block quiz', () => {
    beforeEach(async () => {
      game = await harness.createGateway({
        rounds: TWO_BLOCK_QUIZ,
        teamNames: ['The Quizzards'],
      });
    });

    it("previews the leaderboard after a block's last reveal, then the next round's title once every team is shown", async () => {
      await game.act('START_QUIZ');
      await advance(2); // round_intro, q1
      await answerFirstQuestion('ABBA');
      await advance(4); // locking, break_intro, reveal_intro, reveal

      expect(screens()).toMatchObject({
        current: 'Revealing R1 Q1',
        next: 'Leaderboard',
        nextBody: undefined,
      });

      await advance(1); // -> leaderboard over round_intro(1)
      expect(screens()).toMatchObject({
        current: 'Leaderboard',
        nextBody: 'Next place (1 of 1)',
      });

      await game.act('REVEAL_NEXT_TEAM');
      expect(screens()).toMatchObject({
        next: 'Round 2 title',
        nextBody: 'Sport',
      });
    });
  });
});
