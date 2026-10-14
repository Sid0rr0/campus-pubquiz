import { describe, expect, it } from 'vitest';
import { createChimeLimiter, findNewTeamIds } from '@/app/lib/lobby-chime';

describe('createChimeLimiter', () => {
  it('allows at most two chimes when ten teams join within a second', () => {
    let nowMs = 0;
    const limiter = createChimeLimiter(500, () => nowMs);

    let chimes = 0;
    for (let join = 0; join < 10; join += 1) {
      nowMs = join * 100;
      if (limiter.shouldChime()) chimes += 1;
    }

    expect(chimes).toBe(2);
  });

  it('chimes again once the gap has passed', () => {
    let nowMs = 0;
    const limiter = createChimeLimiter(500, () => nowMs);

    expect(limiter.shouldChime()).toBe(true);
    nowMs = 499;
    expect(limiter.shouldChime()).toBe(false);
    nowMs = 500;
    expect(limiter.shouldChime()).toBe(true);
  });
});

describe('findNewTeamIds', () => {
  it('returns nothing for the first snapshot', () => {
    expect(findNewTeamIds(null, [{ teamId: 1 }, { teamId: 2 }])).toEqual([]);
  });

  it('returns only teams that were not in the previous snapshot', () => {
    const previous = new Set([1, 2]);

    expect(
      findNewTeamIds(previous, [{ teamId: 1 }, { teamId: 2 }, { teamId: 3 }]),
    ).toEqual([3]);
  });
});
