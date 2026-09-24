import { describe, expect, it } from 'vitest';
import {
  getLeaderboardRevealStepCount,
  getTiedForFirst,
} from '../leaderboard-tiebreak';
import type { LeaderboardEntry } from '../socket-events';

function entry(
  teamId: number,
  teamName: string,
  totalPoints: number,
): LeaderboardEntry {
  return {
    teamId,
    teamName,
    totalPoints,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
  };
}

describe('getTiedForFirst', () => {
  it('returns an empty array when there is an outright leader', () => {
    const leaderboard = [
      entry(1, 'Alpha', 20),
      entry(2, 'Beta', 15),
      entry(3, 'Gamma', 15),
    ];

    expect(getTiedForFirst(leaderboard)).toEqual([]);
  });

  it('returns both teams tied for 1st', () => {
    const leaderboard = [
      entry(1, 'Alpha', 20),
      entry(2, 'Beta', 20),
      entry(3, 'Gamma', 15),
    ];

    expect(getTiedForFirst(leaderboard)).toEqual([
      entry(1, 'Alpha', 20),
      entry(2, 'Beta', 20),
    ]);
  });

  it('generalizes to a 3-way (or wider) tie for 1st', () => {
    const leaderboard = [
      entry(1, 'Alpha', 20),
      entry(2, 'Beta', 20),
      entry(3, 'Gamma', 20),
      entry(4, 'Delta', 10),
    ];

    expect(getTiedForFirst(leaderboard)).toEqual([
      entry(1, 'Alpha', 20),
      entry(2, 'Beta', 20),
      entry(3, 'Gamma', 20),
    ]);
  });

  it('returns an empty array for a single-team leaderboard', () => {
    expect(getTiedForFirst([entry(1, 'Alpha', 20)])).toEqual([]);
  });

  it('returns an empty array for an empty leaderboard', () => {
    expect(getTiedForFirst([])).toEqual([]);
  });

  it('preserves leaderboard order (points desc, name asc) as seatIndex order', () => {
    const leaderboard = [
      entry(2, 'Beta', 20),
      entry(1, 'Alpha', 20),
      entry(3, 'Gamma', 5),
    ];

    expect(getTiedForFirst(leaderboard).map((e) => e.teamId)).toEqual([2, 1]);
  });
});

describe('getLeaderboardRevealStepCount', () => {
  it('counts one step per team when nobody is tied', () => {
    const leaderboard = [
      entry(1, 'Alpha', 30),
      entry(2, 'Beta', 20),
      entry(3, 'Gamma', 10),
    ];

    expect(getLeaderboardRevealStepCount(leaderboard, false)).toBe(3);
  });

  it('counts a tied group as a single step', () => {
    const leaderboard = [
      entry(1, 'Alpha', 30),
      entry(2, 'Beta', 20),
      entry(3, 'Gamma', 20),
      entry(4, 'Delta', 20),
      entry(5, 'Echo', 10),
      entry(6, 'Foxtrot', 10),
    ];

    expect(getLeaderboardRevealStepCount(leaderboard, false)).toBe(3);
  });

  it('only counts distinct ranks within the top-5 cutoff for a kahoot round', () => {
    const leaderboard = [
      entry(1, 'Alpha', 30),
      entry(2, 'Beta', 30),
      entry(3, 'Gamma', 20),
      entry(4, 'Delta', 10),
      entry(5, 'Echo', 10),
      entry(6, 'Foxtrot', 5),
      entry(7, 'Golf', 1),
    ];

    expect(getLeaderboardRevealStepCount(leaderboard, true)).toBe(3);
  });

  it('returns 0 for an empty leaderboard', () => {
    expect(getLeaderboardRevealStepCount([], false)).toBe(0);
  });
});
