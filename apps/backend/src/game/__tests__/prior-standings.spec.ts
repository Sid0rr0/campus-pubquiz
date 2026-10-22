import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  CAPITAL_QUESTION,
  advanceToBlockBoard,
  advanceUntil,
  freezeClockAt,
  restoreClock,
  setupRealStoreGatewayTest,
  submitAnswer,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const KAHOOT_TIMER_SECONDS = 10;
const BONUS_POINTS = 3;

describe('GameGateway — prior standings behind the display count-up board', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(() => {
    freezeClockAt('2024-01-01T00:00:00.000Z');
  });

  /** A kahoot round of two questions, opened on its first. Kahoot answers are scored on air, so their points land after the board the question opened on. */
  async function openKahootRound() {
    game = await harness.createGateway({
      teamNames: ['First', 'Second'],
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

  afterEach(() => {
    restoreClock();
  });

  function displayView() {
    return game.gameState.getView(game.joinCode, SOCKET_ROOMS.DISPLAY);
  }

  /** The board the big screen draws; fails unless the leaderboard is on air. */
  function boardOf(view: ReturnType<typeof displayView>) {
    if (view.screen.kind !== 'leaderboard') {
      throw new Error(`Expected the leaderboard, got ${view.screen.kind}`);
    }
    return view.screen.board;
  }

  /** The board the big screen counts up from between kahoot questions. */
  function countUpBoard() {
    const { countUpBoard: board } = boardOf(displayView());
    if (board === undefined) throw new Error('no count-up board was sent');
    return board;
  }

  function totals(
    board: { teamId: number; totalPoints: number }[],
  ): Record<number, number> {
    return Object.fromEntries(board.map((e) => [e.teamId, e.totalPoints]));
  }

  async function awardBonus(teamIndex: number) {
    const admin = await game.connectAdmin();
    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: game.teams[teamIndex].teamId,
      category: 'shot',
      points: BONUS_POINTS,
    });
  }

  /** Locks q0, then points land for the first team on the reveal, and the next question opens behind the leaderboard. */
  async function landFirstQuestionPoints() {
    await game.act('ADVANCE'); // -> locking
    await game.act('ADVANCE'); // -> reveal
    await awardBonus(0);
    await game.act('ADVANCE'); // -> q1 open behind the leaderboard
  }

  describe('in a kahoot round', () => {
    beforeEach(openKahootRound);

    it('holds the standings from before the last question points landed', async () => {
      await landFirstQuestionPoints();

      const view = displayView();
      const [first, second] = game.teams;
      expect(view.progress.isLeaderboardVisible).toBe(true);
      expect(totals(view.leaderboard)[first.teamId]).toBeGreaterThan(0);
      expect(totals(countUpBoard())).toEqual({
        [first.teamId]: 0,
        [second.teamId]: 0,
      });
    });

    it('sends a resyncing big screen the same count-up board', async () => {
      await landFirstQuestionPoints();

      const resynced = await game.resync('display');

      expect(boardOf(resynced)).toEqual(boardOf(displayView()));
      expect(boardOf(resynced).countUpBoard).toBeDefined();
    });

    it('freezes the count-up board when the question opens, so a bonus awarded on air counts as movement', async () => {
      await awardBonus(1);
      await landFirstQuestionPoints();

      const prior = totals(countUpBoard());

      expect(prior[game.teams[1].teamId]).toBe(0);
      expect(prior[game.teams[0].teamId]).toBe(0);
    });

    it('keeps the count-up board from the question opening when the leaderboard is toggled over it', async () => {
      await awardBonus(1); // on air
      await game.act('TOGGLE_LEADERBOARD'); // shown over q0
      await game.act('TOGGLE_LEADERBOARD'); // hidden: q0 is answered again
      await landFirstQuestionPoints();

      expect(totals(countUpBoard())[game.teams[1].teamId]).toBe(0);
    });

    it('keeps the count-up board from the question opening after Previous and Advance again', async () => {
      await awardBonus(1); // on air
      await game.act('PREVIOUS'); // -> round_intro
      await game.act('ADVANCE'); // -> q0 open again
      await landFirstQuestionPoints();

      expect(totals(countUpBoard())[game.teams[1].teamId]).toBe(0);
    });

    it('leaves the count-up board untouched while the leaderboard is shown', async () => {
      await landFirstQuestionPoints();
      const before = countUpBoard();

      await awardBonus(1); // lands while the board is up

      expect(countUpBoard()).toEqual(before);
    });

    it('sends no count-up board on the first board after a backend restart', async () => {
      await landFirstQuestionPoints();

      const restarted = await game.restart();

      const leaderboardBoard = boardOf(await restarted.resync('display'));
      expect(leaderboardBoard.countUpBoard).toBeUndefined();
      expect(leaderboardBoard.entries).toHaveLength(2);
    });
  });

  describe('in an ordinary block of several rounds', () => {
    it('takes nothing when a later round of the block opens, so its reveal board compares against the board before the block', async () => {
      game = await harness.createGateway({
        teamNames: ['Leader', 'Chaser'],
        rounds: [
          { title: 'One', questions: [CAPITAL_QUESTION] },
          {
            title: 'Two',
            breakAfter: true,
            questions: [{ ...CAPITAL_QUESTION, prompt: 'Capital of Spain?' }],
          },
        ],
      });
      const [leader, chaser] = game.teams;
      await awardBonus(0); // Leader leads before the block
      const progress = () => game.sessionWrite.read(game.joinCode).progress;
      await game.act('START_QUIZ');
      await advanceUntil(game, 'question_open');
      await submitAnswer(game, 1, 'Paris'); // Chaser passes Leader on air in round One
      await game.act('ADVANCE'); // -> round Two's intro, same block
      await game.act('ADVANCE'); // -> round Two's question opens
      expect(progress().roundIndex).toBe(1);
      expect(progress().status).toBe('question_open');

      await advanceToBlockBoard(game);

      expect(boardOf(displayView()).trends).toEqual({
        [chaser.teamId]: 'up',
        [leader.teamId]: 'down',
      });
    });
  });
});
