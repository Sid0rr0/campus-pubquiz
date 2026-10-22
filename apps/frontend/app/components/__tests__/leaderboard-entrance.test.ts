import { describe, expect, it } from 'vitest';
import type { LeaderboardRow } from '@/app/components/leaderboard-rows';
import {
  isTopThreeReveal,
  rankEntrance,
} from '@/app/components/leaderboard-entrance';

function rowAt(rankIndex: number): LeaderboardRow {
  return {
    rankIndex,
    label: `${rankIndex + 1}.`,
    isJokerStamped: false,
    entry: {
      teamId: rankIndex + 1,
      teamName: `Team ${rankIndex + 1}`,
      totalPoints: 0,
      rank: rankIndex + 1,
      rankTo: rankIndex + 1,
      bonusPoints: 0,
      positiveBonusPoints: 0,
      negativeBonusPoints: 0,
      roundPoints: [],
    },
  };
}

describe('rankEntrance', () => {
  it('takes the top three slower than the other ranks', () => {
    const others = rankEntrance(3, false).durationSeconds;

    for (const topRankIndex of [0, 1, 2]) {
      expect(rankEntrance(topRankIndex, false).durationSeconds).toBeGreaterThan(
        others,
      );
    }
  });

  it('slides every rank in from below', () => {
    expect(rankEntrance(0, false).offsetY).toBeGreaterThan(0);
    expect(rankEntrance(5, false).offsetY).toBeGreaterThan(0);
  });

  it('is a plain crossfade at normal speed under reduced motion', () => {
    const reduced = rankEntrance(0, true);

    expect(reduced.offsetY).toBe(0);
    expect(reduced.durationSeconds).toBe(rankEntrance(5, true).durationSeconds);
  });
});

describe('isTopThreeReveal', () => {
  it('is true when the newest revealed rank is among the top three', () => {
    expect(isTopThreeReveal([rowAt(2), rowAt(3), rowAt(4)])).toBe(true);
    expect(isTopThreeReveal([rowAt(0), rowAt(1), rowAt(2)])).toBe(true);
  });

  it('is false while ranks below the top three are being revealed', () => {
    expect(isTopThreeReveal([rowAt(3), rowAt(4)])).toBe(false);
  });

  it('is false when nothing is revealed yet', () => {
    expect(isTopThreeReveal([])).toBe(false);
  });
});
