import {
  type AdvanceSlotStep,
  type GameAction,
  getLeaderboardRevealStepCount,
  type PreviousState,
  projectScreen,
  SOCKET_ROOMS,
} from '@campus-pubquiz/types';
import type { GameSessionStore } from '@/game/state/game-session.store';
import { asSocket } from '@/game/__tests__/test-utils';
import { createAnswerer } from '@/game/__tests__/walk-test-utils';
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
    const { advanceStep, previousState } = game.gameState.getView(
      game.joinCode,
      SOCKET_ROOMS.ADMIN,
    );
    return {
      canAdvance: advanceStep !== 'none',
      canGoToPreviousQuestion: previousState !== 'unavailable',
    };
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

  /** Where the quiz is, including the leaderboard: a revealed rank or a hidden board counts as moving. */
  function positionWithBoard() {
    const { leaderboardRevealCount, progress } = game.gameState.getView(
      game.joinCode,
      SOCKET_ROOMS.DISPLAY,
    );
    return JSON.stringify([
      position(),
      progress.isLeaderboardVisible,
      leaderboardRevealCount,
    ]);
  }

  /** Presses the button; true when the handler accepted it and it moved the quiz or the board. */
  async function press(action: Movement): Promise<boolean> {
    const before = positionWithBoard();
    try {
      await game.act(action);
    } catch {
      return false;
    }
    return positionWithBoard() !== before;
  }

  /** Whether the admin view announces `action` as pressable: an Advance slot step other than none, or Previous available. */
  function isAnnouncedAvailable(action: Movement): boolean {
    const { advanceStep, previousState } = game.gameState.getView(
      game.joinCode,
      SOCKET_ROOMS.ADMIN,
    );
    return action === 'ADVANCE'
      ? advanceStep !== 'none'
      : previousState === 'available';
  }

  /** Hides the board when it is up, the way the Leaderboard toggle does, so Previous is not covered. */
  async function clearBoard() {
    const { isLeaderboardVisible } = game.gameState.getSnapshot(
      game.joinCode,
    ).progress;
    if (isLeaderboardVisible) await game.act('TOGGLE_LEADERBOARD');
  }

  /** Asserts the announced availability for `action` matches what the handler does. The quiz moves if it was accepted. */
  async function expectFlagMatchesHandler(action: Movement): Promise<boolean> {
    const announced = isAnnouncedAvailable(action);
    const accepted = await press(action);
    expect(announced).toBe(accepted);
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

      await clearBoard();
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
      expect(projectScreen(legacy, SOCKET_ROOMS.ADMIN).previousState).toBe(
        'unavailable',
      );
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
      await clearBoard();
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

  describe('the announced Advance slot and Previous state across whole quizzes', () => {
    const MAX_WALK_STEPS = 120;

    interface WalkPoint {
      slot: AdvanceSlotStep;
      status: string;
      isBoardUp: boolean;
      revealCount: number;
      stepCount: number;
      rankedTeamCount: number;
    }

    function adminView() {
      return game.gameState.getView(game.joinCode, SOCKET_ROOMS.ADMIN);
    }

    function displayView() {
      return game.gameState.getView(game.joinCode, SOCKET_ROOMS.DISPLAY);
    }

    function announcedAdvanceSlot(): AdvanceSlotStep {
      return adminView().advanceStep;
    }

    function announcedPrevious(): PreviousState {
      return adminView().previousState;
    }

    function boardState() {
      const view = adminView();
      return {
        position: position(),
        isBoardUp: view.progress.isLeaderboardVisible,
        revealCount: displayView().leaderboardRevealCount,
      };
    }

    function previewNext() {
      return (
        game.gameState.getPresenterContext(game.joinCode).nextScreen ?? null
      );
    }

    /** Sends the action; false when the gateway rejected it. */
    async function tryAct(action: GameAction): Promise<boolean> {
      try {
        await game.act(action);
        return true;
      } catch {
        return false;
      }
    }

    const answerWith = (
      specs: QuizRoundSpec[],
      isCorrect: (teamIndex: number, questionOrdinal: number) => boolean,
    ) => createAnswerer(game, specs, isCorrect);

    /**
     * Presses a raw ADVANCE until the Advance slot is gone, checking at every point that what was announced is what happened and
     * that the presenter preview's "next" line is empty exactly when it did
     * nothing.
     */
    async function walkForward(
      answerOpenQuestion: () => Promise<void>,
    ): Promise<WalkPoint[]> {
      const points: WalkPoint[] = [];
      for (let step = 0; step < MAX_WALK_STEPS; step += 1) {
        await answerOpenQuestion();
        const view = adminView();
        const slot = announcedAdvanceSlot();
        points.push({
          slot,
          status: view.progress.status,
          isBoardUp: view.progress.isLeaderboardVisible,
          revealCount: displayView().leaderboardRevealCount,
          stepCount: getLeaderboardRevealStepCount(
            view.leaderboard,
            view.isCurrentRoundKahoot ?? false,
          ),
          rankedTeamCount: view.leaderboard.length,
        });
        const next = previewNext();
        const before = boardState();

        if (slot === 'none') {
          expect(next).toBeNull();
          expect(await tryAct('ADVANCE')).toBe(false);
          expect(boardState()).toEqual(before);
          return points;
        }

        await game.act('ADVANCE');
        const after = boardState();
        if (slot === 'reveal_next_rank') {
          expect(next).not.toBeNull();
          expect(after.position).toBe(before.position);
          expect(after.revealCount).toBe(before.revealCount + 1);
        } else if (slot === 'hide_leaderboard') {
          expect(next).not.toBeNull();
          expect(after.position).toBe(before.position);
          expect(after.isBoardUp).toBe(false);
        } else {
          // Pressable but unmoving is only the last showdown step, which
          // ADVANCE answers without moving; the preview is empty there too.
          const moved = after.position !== before.position;
          expect(next !== null).toBe(moved);
          if (!moved) {
            expect(before.position).toContain('"ended"');
            return points;
          }
        }
      }
      throw new Error('the forward walk never reached a point with no Advance');
    }

    /**
     * Presses Previous until it is gone. Under the board it checks Previous is
     * announced as covered and a raw PREVIOUS is rejected without changing
     * anything, then hides the board with the Leaderboard toggle.
     */
    async function walkBackward(): Promise<number> {
      let steps = 0;
      for (let guard = 0; guard < MAX_WALK_STEPS; guard += 1) {
        if (adminView().progress.isLeaderboardVisible) {
          expect(announcedPrevious()).toBe('covered_by_leaderboard');
          const covered = boardState();
          expect(await tryAct('PREVIOUS')).toBe(false);
          expect(boardState()).toEqual(covered);
          await game.act('TOGGLE_LEADERBOARD');
        }
        const announced = announcedPrevious();
        expect(announced).not.toBe('covered_by_leaderboard');
        const accepted = await press('PREVIOUS');
        expect(announced === 'available').toBe(accepted);
        if (!accepted) return steps;
        steps += 1;
      }
      throw new Error(
        'the backward walk never reached a point with no Previous',
      );
    }

    const TWO_BLOCK_QUIZ: QuizRoundSpec[] = [
      {
        title: 'Music',
        breakAfter: true,
        questions: [
          { type: 'free_text', prompt: 'Band?', answer: 'ABBA', points: 1 },
          { type: 'free_text', prompt: 'Song?', answer: 'Waterloo', points: 1 },
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

    function slotsOf(points: WalkPoint[]): Set<AdvanceSlotStep> {
      return new Set(points.map((point) => point.slot));
    }

    describe('a two-block quiz through break, reveal and the end-of-block leaderboard', () => {
      beforeEach(async () => {
        game = await harness.createGateway({
          rounds: TWO_BLOCK_QUIZ,
          teamNames: ['Team A', 'Team B'],
        });
      });

      it('announces what Advance does at every point to the end of the quiz', async () => {
        await game.act('START_QUIZ');
        const answer = answerWith(TWO_BLOCK_QUIZ, (team) => team === 0);

        const points = await walkForward(answer);

        expect(slotsOf(points)).toEqual(
          new Set(['advance', 'reveal_next_rank', 'hide_leaderboard', 'none']),
        );
        expect(points.at(-1)).toMatchObject({ status: 'ended' });
        // Both blocks end on a board: the mid-quiz one and the final one.
        const boardsRevealed = points.filter(
          (point) => point.slot === 'hide_leaderboard',
        );
        expect(boardsRevealed.length).toBeGreaterThanOrEqual(1);
      });

      it('announces whether Previous works at every point back from the end', async () => {
        await game.act('START_QUIZ');
        await walkForward(answerWith(TWO_BLOCK_QUIZ, (team) => team === 0));

        const steps = await walkBackward();

        expect(steps).toBeGreaterThan(5);
      });
    });

    describe('a leaderboard tie', () => {
      it('counts tied teams as one reveal step', async () => {
        game = await harness.createGateway({
          rounds: TWO_BLOCK_QUIZ,
          teamNames: ['Team A', 'Team B'],
        });
        await game.act('START_QUIZ');

        const points = await walkForward(
          answerWith(TWO_BLOCK_QUIZ, () => true),
        );

        const board = points.filter((point) => point.isBoardUp);
        expect(board.length).toBeGreaterThan(0);
        for (const point of board) {
          expect(point.rankedTeamCount).toBe(2);
          expect(point.stepCount).toBe(1);
        }
      });
    });

    describe('a kahoot round', () => {
      const KAHOOT_TEAMS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
      const KAHOOT_QUIZ: QuizRoundSpec[] = [
        {
          title: 'Kahoot',
          breakAfter: true,
          kahootMode: true,
          questions: ['A', 'B', 'C', 'D', 'E'].map((answer) => ({
            type: 'free_text' as const,
            prompt: `Say ${answer}`,
            answer,
            points: 1,
          })),
        },
      ];

      beforeEach(async () => {
        game = await harness.createGateway({
          rounds: KAHOOT_QUIZ,
          teamNames: KAHOOT_TEAMS,
        });
        await game.act('START_QUIZ');
      });

      it('announces the between-questions board and the capped round-end board at every point', async () => {
        // Team N gets the first N questions right: six different scores.
        const answer = answerWith(
          KAHOOT_QUIZ,
          (team, question) => question < team,
        );

        const points = await walkForward(answer);

        // Between questions the whole top 5 is already shown, so Advance just hides it.
        const between = points.filter(
          (point) =>
            point.isBoardUp &&
            point.status === 'question_open' &&
            point.slot === 'hide_leaderboard',
        );
        expect(between.length).toBeGreaterThan(0);
        // The round-end board walks one rank at a time, stopping at the top 5.
        const roundEnd = points.filter(
          (point) => point.isBoardUp && point.status === 'ended',
        );
        expect(roundEnd.every((point) => point.stepCount === 5)).toBe(true);
        expect(
          roundEnd.filter((point) => point.slot === 'reveal_next_rank'),
        ).toHaveLength(5);
      });

      it('announces whether Previous works at every point back from the end', async () => {
        await walkForward(
          answerWith(KAHOOT_QUIZ, (team, question) => question < team),
        );

        const steps = await walkBackward();

        expect(steps).toBeGreaterThan(5);
      });
    });

    describe('a closest_guess reveal', () => {
      const CLOSEST_QUIZ: QuizRoundSpec[] = [
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
            {
              type: 'free_text',
              prompt: 'Name a fruit',
              points: 1,
              answer: 'Apple',
            },
          ],
        },
      ];

      beforeEach(async () => {
        game = await harness.createGateway({
          rounds: CLOSEST_QUIZ,
          teamNames: ['Team A', 'Team B', 'Team C'],
        });
        await game.act('START_QUIZ');
      });

      it('announces every reveal sub-step going forward', async () => {
        const answer = answerWith(CLOSEST_QUIZ, (team) => team === 0);

        const points = await walkForward(answer);

        expect(points.some((point) => point.status === 'reveal')).toBe(true);
      });

      it('announces every reveal sub-step going back', async () => {
        await walkForward(answerWith(CLOSEST_QUIZ, (team) => team === 0));

        const steps = await walkBackward();

        expect(steps).toBeGreaterThan(5);
      });
    });

    describe('an ended quiz with an active showdown', () => {
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

      async function guess(teamIndex: number, value: string) {
        const { socket, teamId } = game.teams[teamIndex];
        const { activeShowdown } = game.gameState.getSnapshot(game.joinCode);
        await game.gateway.handleSubmitShowdownGuess(asSocket(socket), {
          showdownRoundId: activeShowdown!.id,
          teamId,
          value,
        });
      }

      /** Clears the end-of-quiz board with raw ADVANCE: reveal each rank, then hide it. */
      async function clearBoard() {
        while (adminView().progress.isLeaderboardVisible) {
          await game.act('ADVANCE');
        }
      }

      it('keeps Advance pressable but unmoving while every guess is not in, and says why', async () => {
        await clearBoard();
        await guess(0, '40');

        expect(announcedAdvanceSlot()).toBe('advance');
        const before = boardState();
        await expect(game.act('ADVANCE')).rejects.toThrow(
          'not every team has submitted a guess',
        );
        expect(boardState()).toEqual(before);
      });

      it('announces every reveal step once every guess is in', async () => {
        await clearBoard();
        await guess(0, '40');
        await guess(1, '50');

        const points = await walkForward(async () => {});

        expect(points.every((point) => point.status === 'ended')).toBe(true);
        expect(
          points.filter((point) => point.slot === 'advance').length,
        ).toBeGreaterThan(1);
      });
    });
  });
});
