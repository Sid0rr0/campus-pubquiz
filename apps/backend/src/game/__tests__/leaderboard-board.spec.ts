import {
  KAHOOT_LEADERBOARD_TOP_N,
  SOCKET_ROOMS,
  type GameAction,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  freezeClockAt,
  restoreClock,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const KAHOOT_TIMER_SECONDS = 10;
const BONUS_POINTS = 3;
const BIG_BONUS_POINTS = 6;
const TEAM_COUNT = 7;

const QUESTION = {
  type: 'multiple_choice' as const,
  prompt: 'Capital of France?',
  answer: 'Paris',
  points: 10,
  payload: { options: ['Paris', 'London'] },
};

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
          questions: [QUESTION, { ...QUESTION, prompt: 'Capital of UK?' }],
        },
      ],
      settings: { kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS },
    });
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro
    await game.act('ADVANCE'); // -> question_open q0
  }

  function board() {
    return game.gameState.getView(game.joinCode, SOCKET_ROOMS.DISPLAY)
      .leaderboardBoard;
  }

  function revealCount() {
    return game.gameState.getView(game.joinCode, SOCKET_ROOMS.DISPLAY)
      .leaderboardRevealCount;
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

    it('compares trends against the standings before the last question, not the whole round', async () => {
      await openKahootRound(['First', 'Second']);
      await awardBonus(0); // on air: part of the prior standings
      await actAll(['ADVANCE', 'ADVANCE']);
      await awardBonus(1, BIG_BONUS_POINTS);
      await game.act('ADVANCE');

      expect(board().trends).toEqual({
        [game.teams[0].teamId]: 'down',
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

      expect((await game.resync('display')).leaderboardBoard).toEqual(board());
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

  describe('in an ordinary round', () => {
    it('sends every team, no count-up board, and trends against the round backed out', async () => {
      game = await harness.createGateway({ teamNames: ['First', 'Second'] });
      await actAll(['START_QUIZ', 'ADVANCE', 'ADVANCE']); // -> first question
      for (const [{ socket, teamId }, value] of [
        [game.teams[0], 'Paris'],
        [game.teams[1], 'London'],
      ] as const) {
        await game.gateway.handleSubmitAnswer(asSocket(socket), {
          questionId: game.questionIds.multipleChoice,
          teamId,
          value,
        });
      }

      await game.act('TOGGLE_LEADERBOARD');

      const { entries, countUpBoard, trends } = board();
      expect(entries).toHaveLength(2);
      expect(countUpBoard).toBeUndefined();
      expect(trends).toEqual({
        [game.teams[0].teamId]: 'same',
        [game.teams[1].teamId]: 'down',
      });
    });
  });
});
