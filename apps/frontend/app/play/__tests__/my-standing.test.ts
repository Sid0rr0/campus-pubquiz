import { describe, expect, it } from 'vitest';
import type { LeaderboardBoard, LeaderboardEntry } from '@campus-pubquiz/types';
import { findMyStanding } from '@/app/play/my-standing';

function ranked(teamId: number, totalPoints: number, rank: number) {
  return {
    teamId,
    teamName: `Team ${teamId}`,
    totalPoints,
    rank,
    rankTo: rank,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
  } satisfies LeaderboardEntry;
}

const BOARD: LeaderboardBoard = {
  entries: [ranked(1, 30, 1), ranked(2, 20, 2), ranked(3, 10, 3)],
  trends: { 1: 'up' },
  jokerTeamIds: [2],
};

describe('findMyStanding', () => {
  it('is the team own row with its trend', () => {
    expect(findMyStanding(BOARD, 3, 1)).toStrictEqual({
      entry: ranked(1, 30, 1),
      trend: 'up',
      isJokerStamped: false,
    });
  });

  it('carries no trend key for a team the board sent none for, and its joker stamp', () => {
    expect(findMyStanding(BOARD, 3, 2)).toStrictEqual({
      entry: ranked(2, 20, 2),
      isJokerStamped: true,
    });
  });

  it('is null while the big screen has not revealed the team rank yet', () => {
    expect(findMyStanding(BOARD, 1, 1)).toBeNull();
  });

  it('is null for a team the board does not carry', () => {
    expect(findMyStanding(BOARD, 3, 99)).toBeNull();
  });

  it('is null for a phone with no team', () => {
    expect(findMyStanding(BOARD, 3, null)).toBeNull();
  });
});
