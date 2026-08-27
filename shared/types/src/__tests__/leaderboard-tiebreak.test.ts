import { describe, expect, it } from 'vitest';
import { getTiedForFirst } from '../leaderboard-tiebreak';
import type { LeaderboardEntry } from '../socket-events';

function entry(
  teamId: number,
  teamName: string,
  totalPoints: number,
): LeaderboardEntry {
  return { teamId, teamName, totalPoints, bonusPoints: 0, roundPoints: [] };
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
