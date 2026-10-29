import {
  KAHOOT_LEADERBOARD_TOP_N,
  SOCKET_ROOMS,
  type DisplayStatePayload,
  type GameAction,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  CAPITAL_QUESTION,
  advanceToBlockBoard,
  advanceUntil,
  freezeClockAt,
  restoreClock,
  setupRealStoreGatewayTest,
  submitAnswer,
  submitAnswers,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const KAHOOT_TIMER_SECONDS = 10;
const BONUS_POINTS = 3;
const BIG_BONUS_POINTS = 6;
const TEAM_COUNT = 7;

describe('GameGateway — the leaderboard description on the display view', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(() => {
    freezeClockAt('2024-01-01T00:00:00.000Z');
  });

  afterEach(() => {
    restoreClock();
  });

  /** A kahoot round of two questions, opened on its first question. */
  async function openKahootRound(teamNames: string[]): Promise<void> {
    game = await harness.createGateway({
      teamNames,
      rounds: [
        {
          title: 'Speed Round',
          kahootMode: true,
          questions: [
            CAPITAL_QUESTION,
            { ...CAPITAL_QUESTION, prompt: 'Capital of UK?' },
          ],
        },
      ],
      settings: { kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS },
    });
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro
    await game.act('ADVANCE'); // -> question_open q0
  }

  function leaderboardScreen(view: DisplayStatePayload) {
    if (view.screen.kind !== 'leaderboard') {
      throw new Error(`Expected the leaderboard, got ${view.screen.kind}`);
    }
    return view.screen;
  }

  function board() {
    return leaderboardScreen(
      game.gameState.getView(game.joinCode, SOCKET_ROOMS.DISPLAY),
    ).board;
  }

  function revealCount() {
    return leaderboardScreen(
      game.gameState.getView(game.joinCode, SOCKET_ROOMS.DISPLAY),
    ).revealCount;
  }

  async function awardBonus(teamIndex: number, points = BONUS_POINTS) {
    const admin = await game.connectAdmin();
    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: game.teams[teamIndex].teamId,
      category: 'shot',
      points,
    });
  }

  async function actAll(actions: GameAction[]) {
    for (const action of actions) await game.act(action);
  }

  describe('between kahoot questions', () => {
    it('caps the entries at the top five and counts up the same teams from the old totals', async () => {
      await openKahootRound(
        Array.from({ length: TEAM_COUNT }, (_, index) => `Team ${index}`),
      );
      await actAll(['ADVANCE', 'ADVANCE']); // -> reveal
      await awardBonus(TEAM_COUNT - 1);
      await game.act('ADVANCE'); // -> q1 behind the leaderboard

      const { entries, countUpBoard } = board();

      expect(entries).toHaveLength(KAHOOT_LEADERBOARD_TOP_N);
      expect(entries[0].teamId).toBe(game.teams[TEAM_COUNT - 1].teamId);
      expect(countUpBoard?.map((entry) => entry.teamId).sort()).toEqual(
        entries.map((entry) => entry.teamId).sort(),
      );
      expect(countUpBoard?.every((entry) => entry.totalPoints === 0)).toBe(
        true,
      );
    });

    it('reveals the whole capped board at once, with one step per rank of the entries', async () => {
      await openKahootRound(
        Array.from({ length: TEAM_COUNT }, (_, index) => `Team ${index}`),
      );
      await actAll(['ADVANCE', 'ADVANCE']);
      await awardBonus(TEAM_COUNT - 1);
      await game.act('ADVANCE');

      expect(revealCount()).toBe(
        new Set(board().entries.map((entry) => entry.rank)).size,
      );
    });

    it('gives every team up when everyone was tied before', async () => {
      await openKahootRound(['First', 'Second']);
      await actAll(['ADVANCE', 'ADVANCE']);
      await awardBonus(0);
      await game.act('ADVANCE');

      expect(board().trends).toEqual({
        [game.teams[0].teamId]: 'up',
        [game.teams[1].teamId]: 'up',
      });
    });

    it('counts a bonus awarded on air as movement on the board that follows', async () => {
      await openKahootRound(['First', 'Second']);
      await awardBonus(0); // on air: the board is frozen when the question opens
      await actAll(['ADVANCE', 'ADVANCE']);
      await awardBonus(1, BIG_BONUS_POINTS);
      await game.act('ADVANCE');

      expect(board().countUpBoard?.map((entry) => entry.totalPoints)).toEqual([
        0, 0,
      ]);
      expect(board().trends).toEqual({
        [game.teams[0].teamId]: 'up',
        [game.teams[1].teamId]: 'up',
      });
    });

    it('counts up from the board before the question, however many answers landed on air', async () => {
      await openKahootRound(['First', 'Second']);
      await submitAnswers(game, ['Paris', 'London']); // First scores on air
      await actAll(['ADVANCE', 'ADVANCE', 'ADVANCE']); // -> q1 behind the board

      const { countUpBoard, trends } = board();

      expect(countUpBoard?.map((entry) => entry.totalPoints)).toEqual([0, 0]);
      expect(trends).toEqual({
        [game.teams[0].teamId]: 'up',
        [game.teams[1].teamId]: 'up',
      });
    });

    it('compares trends against the standings before the last question when its answers landed on air', async () => {
      await openKahootRound(['First', 'Second']);
      await submitAnswers(game, ['Paris', 'London']);
      await actAll(['ADVANCE', 'ADVANCE', 'ADVANCE', 'TOGGLE_LEADERBOARD']);
      await submitAnswers(game, ['London', 'Paris'], { questionIndex: 1 }); // Second draws level
      await actAll(['ADVANCE', 'ADVANCE', 'ADVANCE']);

      expect(board().trends).toEqual({
        [game.teams[0].teamId]: 'same',
        [game.teams[1].teamId]: 'up',
      });
    });

    it('gives a team that was not on the previous board no trend', async () => {
      await openKahootRound(['First', 'Second']);
      await awardBonus(0);
      await actAll(['ADVANCE', 'ADVANCE']);
      await game.act('ADVANCE');

      const late = await game.joinTeam('Late');

      const { entries, trends } = board();
      expect(entries.map((entry) => entry.teamId)).toContain(late.teamId);
      expect(trends).not.toHaveProperty(String(late.teamId));
    });

    it('sends a resyncing big screen the same description as one connected throughout', async () => {
      await openKahootRound(['First', 'Second']);
      await awardBonus(0);
      await actAll(['ADVANCE', 'ADVANCE']);
      await awardBonus(1, BIG_BONUS_POINTS);
      await game.act('ADVANCE');

      expect(leaderboardScreen(await game.resync('display')).board).toEqual(
        board(),
      );
    });
  });

  describe('at the end of a kahoot round', () => {
    async function reachQuizEnd(): Promise<void> {
      await openKahootRound(['First', 'Second']);
      await awardBonus(0); // on air during q0
      await actAll(['ADVANCE', 'ADVANCE', 'ADVANCE']); // -> q1 behind the board
      await game.act('TOGGLE_LEADERBOARD');
      await actAll(['ADVANCE', 'ADVANCE']); // -> reveal
      await awardBonus(1);
      await game.act('ADVANCE'); // -> ended, leaderboard up
    }

    it('sends no count-up board and reveals one rank at a time', async () => {
      await reachQuizEnd();

      expect(board().countUpBoard).toBeUndefined();
      expect(revealCount()).toBe(0);
      await game.act('ADVANCE');
      expect(revealCount()).toBe(1);
    });

    it('compares trends against the standings before the last question', async () => {
      await reachQuizEnd();

      expect(board().trends).toEqual({
        [game.teams[0].teamId]: 'same',
        [game.teams[1].teamId]: 'up',
      });
    });
  });

  describe('at the end of a kahoot round (also the quiz end) with an untouched prior board', () => {
    /** Plays both questions with nothing scored before the last one, then awards `bonuses` at its reveal and advances to the end. */
    async function reachEndAwarding(
      teamNames: string[],
      bonuses: number[],
    ): Promise<void> {
      await openKahootRound(teamNames);
      await actAll(['ADVANCE', 'ADVANCE', 'ADVANCE']); // -> q1 behind the board
      await game.act('TOGGLE_LEADERBOARD');
      await actAll(['ADVANCE', 'ADVANCE']); // -> reveal
      for (const [teamIndex, points] of bonuses.entries()) {
        await awardBonus(teamIndex, points);
      }
      await game.act('ADVANCE'); // -> ended, leaderboard up
    }

    it('gives every team on the board up when everyone was tied before the last question, leaving out a team that scored nothing', async () => {
      await reachEndAwarding(['First', 'Second', 'Third'], [BONUS_POINTS, 1]);

      expect(board().trends).toEqual({
        [game.teams[0].teamId]: 'up',
        [game.teams[1].teamId]: 'up',
      });
    });

    it('caps the board at the top five, splitting the tie at the cutoff, and reveals one rank at a time', async () => {
      await reachEndAwarding(
        Array.from({ length: TEAM_COUNT }, (_, index) => `Team ${index}`),
        [7, 6, 5, 4, 3, 3], // teams 4 and 5 tie for fifth; team 6 stays on 0
      );

      const { entries, countUpBoard } = board();
      expect(entries).toHaveLength(KAHOOT_LEADERBOARD_TOP_N);
      expect(entries.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5]);
      expect(entries.map((entry) => entry.teamId)).not.toContain(
        game.teams[TEAM_COUNT - 1].teamId,
      );
      expect(countUpBoard).toBeUndefined();
      expect(revealCount()).toBe(0);
      await game.act('ADVANCE');
      expect(revealCount()).toBe(1);
      await game.act('ADVANCE');
      expect(revealCount()).toBe(2);
    });
  });

  describe('in an ordinary block of several rounds', () => {
    it('compares against the board before the whole block, so a team that kept its rank shows no movement', async () => {
      game = await harness.createGateway({
        teamNames: ['Leader', 'Chaser', 'Outsider'],
        rounds: [
          { title: 'One', questions: [CAPITAL_QUESTION] },
          {
            title: 'Two',
            breakAfter: true,
            questions: [
              { ...CAPITAL_QUESTION, prompt: 'Capital of UK?', points: 25 },
            ],
          },
        ],
      });
      const [leader, chaser, outsider] = [0, 1, 2];
      await awardBonus(leader, 30);
      await awardBonus(chaser, 20);
      await awardBonus(outsider, 10);
      await game.act('START_QUIZ');
      await advanceUntil(game, 'question_open');
      await submitAnswers(game, ['London', 'Paris', 'London']); // Chaser draws level on 30
      await advanceUntil(game, 'round_intro'); // -> round two
      await advanceUntil(game, 'question_open');
      // Outsider passes them both on 35
      await submitAnswer(game, outsider, 'Paris', { roundIndex: 1 });
      await advanceUntil(game, 'break_intro');
      await game.act('TOGGLE_LEADERBOARD');

      expect(board().trends).toEqual({
        [game.teams[outsider].teamId]: 'up',
        [game.teams[leader].teamId]: 'down',
        [game.teams[chaser].teamId]: 'same',
      });
    });
  });

  describe('in an ordinary block', () => {
    /** Two ordinary blocks: round One (two questions, then a break) and round Two (one question, then a break). */
    async function createTwoBlockQuiz(teamNames: string[]): Promise<void> {
      game = await harness.createGateway({
        teamNames,
        rounds: [
          {
            title: 'One',
            breakAfter: true,
            questions: [
              CAPITAL_QUESTION,
              { ...CAPITAL_QUESTION, prompt: 'Capital of UK?' },
            ],
          },
          {
            title: 'Two',
            breakAfter: true,
            questions: [{ ...CAPITAL_QUESTION, prompt: 'Capital of Spain?' }],
          },
        ],
      });
    }

    /** Starts the quiz and opens the first block's first question. */
    async function openFirstBlock() {
      await game.act('START_QUIZ');
      await advanceUntil(game, 'question_open');
    }

    it('sends every team, no count-up board, and every team up from an all-tied start', async () => {
      await createTwoBlockQuiz(['First', 'Second']);
      await openFirstBlock();
      await submitAnswers(game, ['Paris', 'London']);

      await advanceToBlockBoard(game);

      const { entries, countUpBoard, trends } = board();
      expect(entries).toHaveLength(2);
      expect(countUpBoard).toBeUndefined();
      expect(trends).toEqual({
        [game.teams[0].teamId]: 'up',
        [game.teams[1].teamId]: 'up',
      });
    });

    it('counts a bonus awarded in the break as movement on the board after the reveal', async () => {
      await createTwoBlockQuiz(['Leader', 'Chaser']);
      await awardBonus(0, BIG_BONUS_POINTS); // before the block
      await openFirstBlock();
      await advanceUntil(game, 'break_intro');
      await awardBonus(1, BIG_BONUS_POINTS * 2); // Chaser passes Leader

      await advanceToBlockBoard(game);

      expect(board().trends).toEqual({
        [game.teams[1].teamId]: 'up',
        [game.teams[0].teamId]: 'down',
      });
    });

    it('counts a bonus awarded before the block opens as part of the board before it', async () => {
      await createTwoBlockQuiz(['Leader', 'Chaser']);
      await game.act('START_QUIZ');
      await advanceUntil(game, 'round_intro');
      await awardBonus(0); // before the block's first question opens
      await advanceUntil(game, 'question_open');

      await advanceToBlockBoard(game);

      expect(board().trends).toEqual({
        [game.teams[0].teamId]: 'same',
        [game.teams[1].teamId]: 'same',
      });
    });

    it('keeps the board before the block after Previous and Advance again, so points scored on air still move', async () => {
      await createTwoBlockQuiz(['Leader', 'Chaser']);
      await awardBonus(0); // Leader leads before the block
      await openFirstBlock();
      await submitAnswers(game, ['London', 'Paris']); // Chaser passes Leader on air
      await game.act('PREVIOUS'); // -> round_intro
      await game.act('ADVANCE'); // -> the block's first question again

      await advanceToBlockBoard(game);

      expect(board().trends).toEqual({
        [game.teams[1].teamId]: 'up',
        [game.teams[0].teamId]: 'down',
      });
    });

    it('keeps the board before the block when the leaderboard is toggled mid-block', async () => {
      await createTwoBlockQuiz(['Leader', 'Chaser']);
      await awardBonus(0);
      await openFirstBlock();
      await submitAnswers(game, ['London', 'Paris']);
      await actAll(['TOGGLE_LEADERBOARD', 'TOGGLE_LEADERBOARD']);

      await advanceToBlockBoard(game);

      expect(board().trends).toEqual({
        [game.teams[1].teamId]: 'up',
        [game.teams[0].teamId]: 'down',
      });
    });

    it('gives a team that joined during the block no trend', async () => {
      await createTwoBlockQuiz(['Leader', 'Chaser']);
      await awardBonus(0);
      await openFirstBlock();
      const late = await game.joinTeam('Late');

      await advanceToBlockBoard(game);

      const { entries, trends } = board();
      expect(entries.map((entry) => entry.teamId)).toContain(late.teamId);
      expect(trends).toEqual({
        [game.teams[0].teamId]: 'same',
        [game.teams[1].teamId]: 'same',
      });
    });

    it('sends a big screen that resyncs mid-block the same trends on the reveal board as one connected throughout', async () => {
      await createTwoBlockQuiz(['Leader', 'Chaser']);
      await awardBonus(0); // Leader leads before the block
      await openFirstBlock();
      await submitAnswers(game, ['London', 'Paris']); // Chaser passes Leader on air
      await game.resync('display'); // the big screen reconnects mid-block

      await advanceToBlockBoard(game);

      const { trends } = leaderboardScreen(await game.resync('display')).board;
      expect(trends).toEqual(board().trends);
      expect(trends).toEqual({
        [game.teams[1].teamId]: 'up',
        [game.teams[0].teamId]: 'down',
      });
    });

    it('gives no trends on the block a backend restart interrupted, and trends again on the next', async () => {
      await createTwoBlockQuiz(['Leader', 'Chaser']);
      await awardBonus(0);
      await openFirstBlock();
      await game.act('ADVANCE'); // -> the block's second question
      await game.act('TOGGLE_LEADERBOARD'); // shown over it
      const { teams } = game;
      game = { ...(await game.restart()), teams };
      await game.act('TOGGLE_LEADERBOARD'); // it is answered again, not the block's first
      await awardBonus(1, BIG_BONUS_POINTS); // Chaser passes Leader

      await advanceToBlockBoard(game);
      expect(board().trends).toEqual({});

      await game.act('TOGGLE_LEADERBOARD'); // -> round Two's intro
      await advanceUntil(game, 'question_open'); // the next block's first question
      await awardBonus(0, BIG_BONUS_POINTS); // Leader passes Chaser back
      await advanceToBlockBoard(game);

      expect(board().trends).toEqual({
        [game.teams[0].teamId]: 'up',
        [game.teams[1].teamId]: 'down',
      });
    });
  });
});
