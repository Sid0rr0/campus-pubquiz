import { SOCKET_ROOMS, type GameAction } from '@campus-pubquiz/types';
import { getActionAvailability } from '@/game/state/action-availability.util';
import type { GameSessionStore } from '@/game/state/game-session.store';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  TWO_ROUND_QUIZ,
  setupRealStoreGatewayTest,
  tieOnFirstQuestion,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

type Movement = 'ADVANCE' | 'PREVIOUS';

describe('Screen projection — Advance/Previous availability', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  function flags() {
    const { canAdvance, canGoToPreviousQuestion } = game.gameState.getView(
      game.joinCode,
      SOCKET_ROOMS.ADMIN,
    );
    return { canAdvance, canGoToPreviousQuestion };
  }

  function position() {
    const snapshot = game.gameState.getSnapshot(game.joinCode);
    const { status, roundIndex, questionIndex, revealIndex } =
      snapshot.progress;
    return JSON.stringify([
      status,
      roundIndex,
      questionIndex,
      revealIndex,
      snapshot.closestGuessRevealStep,
      snapshot.showdownRevealStep,
    ]);
  }

  /** Presses the button; true when the handler accepted it and it moved the quiz. */
  async function press(action: Movement): Promise<boolean> {
    const before = position();
    try {
      await game.act(action);
    } catch {
      return false;
    }
    return position() !== before;
  }

  const FLAG_BY_ACTION = {
    ADVANCE: 'canAdvance',
    PREVIOUS: 'canGoToPreviousQuestion',
  } as const;

  /** Asserts the flag for `action` matches what the handler does. The quiz moves if it was accepted. */
  async function expectFlagMatchesHandler(action: Movement): Promise<boolean> {
    const flag = flags()[FLAG_BY_ACTION[action]];
    const accepted = await press(action);
    expect(flag).toBe(accepted);
    return accepted;
  }

  describe('a two-round quiz walked to the end', () => {
    beforeEach(async () => {
      game = await harness.createGateway({ rounds: TWO_ROUND_QUIZ });
    });

    it('agrees with the handler about Advance at every step forward to the end', async () => {
      await game.act('START_QUIZ');
      while (await expectFlagMatchesHandler('ADVANCE')) {
        // each accepted press lands on the next step, where the loop checks again
      }

      expect(game.gameState.getSnapshot(game.joinCode).progress.status).toBe(
        'ended',
      );
    });

    it('agrees with the handler about Previous at every step back from the end', async () => {
      await game.act('START_QUIZ');
      while (await press('ADVANCE')) {
        // walk to the end
      }

      let steps = 0;
      while (await expectFlagMatchesHandler('PREVIOUS')) steps += 1;

      expect(steps).toBeGreaterThan(10);
    });

    it('allows neither button in the lobby, where only starting the quiz applies', () => {
      expect(flags()).toEqual({
        canAdvance: false,
        canGoToPreviousQuestion: false,
      });
    });

    it('stops Previous at the true start of the reveal history', async () => {
      await game.act('START_QUIZ');
      for (let i = 0; i < 9; i += 1) await game.act('ADVANCE'); // -> reveal_intro
      await game.act('PREVIOUS'); // -> break on the block's last question
      for (let i = 0; i < 9; i += 1) {
        if (!flags().canGoToPreviousQuestion) break;
        await game.act('PREVIOUS');
      }

      expect(game.gameState.getSnapshot(game.joinCode).progress.status).toBe(
        'break_round_intro',
      );
      expect(flags().canGoToPreviousQuestion).toBe(false);
      await expect(game.act('PREVIOUS')).rejects.toThrow();
    });

    it('lets Previous undo the end of the quiz, but not for a legacy session with no recorded earlier status', async () => {
      await game.act('START_QUIZ');
      await game.act('END_QUIZ');
      expect(flags().canGoToPreviousQuestion).toBe(true);

      const session = (
        game.gameState as unknown as { sessionStore: GameSessionStore }
      ).sessionStore.get(game.joinCode);
      const legacy = { ...session, progress: { ...session.progress } };
      delete legacy.progress.previousStatus;
      expect(getActionAvailability(legacy).canGoToPreviousQuestion).toBe(false);
    });

    it('takes the block start from the session rounds', async () => {
      await game.act('START_QUIZ');
      await game.act('ADVANCE'); // round_intro(0)

      const { activeBlockStartIndex } = game.gameState.getView(
        game.joinCode,
        SOCKET_ROOMS.ADMIN,
      );

      expect(activeBlockStartIndex).toBe(0);
    });
  });

  describe('a closest_guess reveal', () => {
    const rounds: QuizRoundSpec[] = [
      {
        title: 'Round 1',
        breakAfter: true,
        questions: [
          {
            type: 'closest_guess',
            prompt: 'How many students attend this university?',
            points: 5,
            answer: '1000',
          },
        ],
      },
    ];

    it('keeps both buttons honest through every reveal sub-step', async () => {
      game = await harness.createGateway({
        rounds,
        teamNames: ['Team A', 'Team B'],
      });
      await game.act('START_QUIZ');
      await game.act('ADVANCE'); // round_intro
      await game.act('ADVANCE'); // the question
      for (const [index, value] of ['900', '950'].entries()) {
        const { socket, teamId } = game.teams[index];
        await game.gateway.handleSubmitAnswer(asSocket(socket), {
          questionId: game.rounds[0].questionIds[0],
          teamId,
          value,
        });
      }
      const toReveal: GameAction[] = [
        'ADVANCE', // locking
        'ADVANCE', // break_intro
        'ADVANCE', // reveal_intro
        'ADVANCE', // reveal, step 0
      ];
      for (const action of toReveal) await game.act(action);

      while (await expectFlagMatchesHandler('ADVANCE')) {
        // each accepted press moves to the next sub-step or question
      }
      while (await expectFlagMatchesHandler('PREVIOUS')) {
        // and back again
      }
    });
  });

  describe('a showdown after the quiz ends', () => {
    beforeEach(async () => {
      game = await harness.createGateway({ teamNames: ['Team A', 'Team B'] });
      await tieOnFirstQuestion(game, game.teams);
      await game.act('END_QUIZ');
      const admin = await game.connectAdmin();
      await game.gateway.handleCreateShowdownRound(asSocket(admin), {
        question: 'How many people are in this room?',
        answer: '42',
        points: 5,
      });
    });

    it('allows Advance but not Previous before the first reveal step', () => {
      expect(flags()).toEqual({
        canAdvance: true,
        canGoToPreviousQuestion: false,
      });
    });

    it('allows Previous once a reveal step has been taken', async () => {
      for (const [index, value] of ['40', '44'].entries()) {
        const { socket, teamId } = game.teams[index];
        const { activeShowdown } = game.gameState.getSnapshot(game.joinCode);
        await game.gateway.handleSubmitShowdownGuess(asSocket(socket), {
          showdownRoundId: activeShowdown!.id,
          teamId,
          value,
        });
      }

      await game.act('ADVANCE');

      expect(flags()).toEqual({
        canAdvance: true,
        canGoToPreviousQuestion: true,
      });
    });
  });
});
