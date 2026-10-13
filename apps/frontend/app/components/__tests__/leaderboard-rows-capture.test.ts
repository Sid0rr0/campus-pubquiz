import { describe, expect, it } from 'vitest';
import type { GameStatus, LeaderboardEntry } from '@campus-pubquiz/types';
import { capturePreviousBoard } from '@/app/components/leaderboard-rows';

function entry(teamId: number, totalPoints: number): LeaderboardEntry {
  return {
    teamId,
    teamName: `Team ${teamId}`,
    totalPoints,
    rank: 1,
    rankTo: 1,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
  };
}

const REMEMBERED = [entry(1, 10)];
const LATEST = [entry(1, 20)];

describe('capturePreviousBoard', () => {
  it.each<{
    name: string;
    status: GameStatus;
    isLeaderboardVisible: boolean;
    leaderboard: LeaderboardEntry[] | undefined;
    expected: LeaderboardEntry[];
  }>([
    {
      name: 'remembers the latest board while the question is open and the leaderboard hidden',
      status: 'question_open',
      isLeaderboardVisible: false,
      leaderboard: LATEST,
      expected: LATEST,
    },
    {
      name: 'remembers the latest board while the question is locking and the leaderboard hidden',
      status: 'locking',
      isLeaderboardVisible: false,
      leaderboard: LATEST,
      expected: LATEST,
    },
    {
      name: 'ignores the latest board while the leaderboard is visible',
      status: 'question_open',
      isLeaderboardVisible: true,
      leaderboard: LATEST,
      expected: REMEMBERED,
    },
    {
      name: 'ignores the latest board once the question is revealed',
      status: 'reveal',
      isLeaderboardVisible: false,
      leaderboard: LATEST,
      expected: REMEMBERED,
    },
    {
      name: 'ignores the latest board in the lobby',
      status: 'lobby',
      isLeaderboardVisible: false,
      leaderboard: LATEST,
      expected: REMEMBERED,
    },
    {
      name: 'ignores an absent leaderboard',
      status: 'question_open',
      isLeaderboardVisible: false,
      leaderboard: undefined,
      expected: REMEMBERED,
    },
  ])('$name', ({ status, isLeaderboardVisible, leaderboard, expected }) => {
    const result = capturePreviousBoard({
      remembered: REMEMBERED,
      status,
      isLeaderboardVisible,
      leaderboard,
    });

    expect(result).toBe(expected);
  });

  it('returns the same reference when the latest board is the remembered one', () => {
    const result = capturePreviousBoard({
      remembered: REMEMBERED,
      status: 'question_open',
      isLeaderboardVisible: false,
      leaderboard: REMEMBERED,
    });

    expect(result).toBe(REMEMBERED);
  });
});
