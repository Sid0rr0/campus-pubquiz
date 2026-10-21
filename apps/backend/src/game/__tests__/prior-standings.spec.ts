import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  freezeClockAt,
  restoreClock,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const KAHOOT_TIMER_SECONDS = 10;
const BONUS_POINTS = 3;

describe('GameGateway — prior standings behind the display count-up board', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    freezeClockAt('2024-01-01T00:00:00.000Z');
    // Kahoot answers are scored on air, so their points land after the board
    // the question opened on.
    const question = {
      type: 'multiple_choice' as const,
      prompt: 'Capital of France?',
      answer: 'Paris',
      points: 10,
      payload: { options: ['Paris', 'London'] },
    };
    game = await harness.createGateway({
      teamNames: ['First', 'Second'],
      rounds: [
        {
          title: 'Speed Round',
          kahootMode: true,
          questions: [question, { ...question, prompt: 'Capital of UK?' }],
        },
      ],
      settings: { kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS },
    });
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro
    await game.act('ADVANCE'); // -> question_open q0
  });

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
