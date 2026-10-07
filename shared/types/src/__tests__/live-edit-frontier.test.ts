import { describe, expect, it } from 'vitest';
import {
  describeLiveEditRounds,
  getOpenedPrefixLength,
  getRoundStructureEditing,
  isRoundReached,
  isRoundStructureFrozen,
  mergeLiveEditFrontiers,
  type LiveEditFrontier,
} from '../live-edit-frontier';

function frontierOf(
  currentRoundIndex: number,
  hasCurrentBlockStartedLocking = false,
  openedQuestionIds: number[] = [],
): LiveEditFrontier {
  return {
    openedQuestionIds,
    currentRoundIndex,
    hasCurrentBlockStartedLocking,
  };
}

describe('mergeLiveEditFrontiers', () => {
  it('takes the further-on session’s current round as the line', () => {
    const merged = mergeLiveEditFrontiers([
      frontierOf(0, false, [1, 2]),
      frontierOf(2, false, [1, 2, 3, 4]),
    ]);

    expect(merged.currentRoundIndex).toBe(2);
  });

  it('unions the opened question ids without duplicates', () => {
    const merged = mergeLiveEditFrontiers([
      frontierOf(0, false, [1, 2]),
      frontierOf(1, false, [2, 3]),
    ]);

    expect(merged.openedQuestionIds).toEqual([1, 2, 3]);
  });

  it('is locking when the furthest-on session’s current block is locking', () => {
    const merged = mergeLiveEditFrontiers([
      frontierOf(2, true),
      frontierOf(0, false),
    ]);

    expect(merged.hasCurrentBlockStartedLocking).toBe(true);
  });

  it('ignores a locking block in a session behind the line', () => {
    const merged = mergeLiveEditFrontiers([
      frontierOf(2, false),
      frontierOf(0, true),
    ]);

    expect(merged.hasCurrentBlockStartedLocking).toBe(false);
  });

  it('is locking when any session on the line is locking', () => {
    const merged = mergeLiveEditFrontiers([
      frontierOf(1, false),
      frontierOf(1, true),
    ]);

    expect(merged.hasCurrentBlockStartedLocking).toBe(true);
  });
});

describe('getRoundStructureEditing', () => {
  it.each([
    [0, false, 'frozen'],
    [1, false, 'after-opened'],
    [2, false, 'free'],
    [5, false, 'free'],
    [0, true, 'frozen'],
    [1, true, 'frozen'],
    [2, true, 'free'],
  ] as const)(
    'round %i with locking %s is %s',
    (roundIndex, isLocking, expected) => {
      expect(
        getRoundStructureEditing(frontierOf(1, isLocking), roundIndex),
      ).toBe(expected);
    },
  );
});

describe('isRoundStructureFrozen', () => {
  it('is true only for a frozen round', () => {
    const frontier = frontierOf(1);

    expect(isRoundStructureFrozen(frontier, 0)).toBe(true);
    expect(isRoundStructureFrozen(frontier, 1)).toBe(false);
    expect(isRoundStructureFrozen(frontier, 2)).toBe(false);
  });
});

describe('getOpenedPrefixLength', () => {
  const opened = new Set([1, 2]);

  it.each([
    [[], 0],
    [[7, 8], 0],
    [[1, 7, 8], 1],
    [[1, 2, 7], 2],
    [[1, 2], 2],
  ])('questions %j have %i opened at the start', (ids, expected) => {
    expect(getOpenedPrefixLength(ids, opened)).toBe(expected);
  });

  it('counts up to the last opened question, wherever it sits', () => {
    expect(getOpenedPrefixLength([7, 2, 8], opened)).toBe(2);
  });

  it('ignores questions without an id yet', () => {
    expect(getOpenedPrefixLength([undefined, 1], opened)).toBe(2);
  });
});

describe('isRoundReached', () => {
  it('counts the current round and every earlier round as reached', () => {
    const frontier = frontierOf(2);

    expect([0, 1, 2].map((index) => isRoundReached(frontier, index))).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('leaves the rounds after the current round unreached', () => {
    const frontier = frontierOf(2);

    expect([3, 4].map((index) => isRoundReached(frontier, index))).toEqual([
      false,
      false,
    ]);
  });

  it('keeps the current round reached while only its title card is showing', () => {
    expect(isRoundReached(frontierOf(1, false, []), 1)).toBe(true);
  });
});

describe('describeLiveEditRounds', () => {
  // Round 1 has two opened questions (11, 12) then an unopened one (13).
  const rounds = [
    { questionIds: [1, 2] },
    { questionIds: [11, 12, 13] },
    { questionIds: [21, undefined] },
    { questionIds: [] },
  ];

  const describeAt = (frontier: LiveEditFrontier) =>
    describeLiveEditRounds(frontier, rounds);

  it('pins nothing before any question has opened', () => {
    expect(describeAt(frontierOf(0))).toEqual([
      {
        isReached: true,
        structureEditing: 'after-opened',
        pinnedQuestionCount: 0,
        canTakeMovedQuestion: true,
        lockReason: null,
      },
      {
        isReached: false,
        structureEditing: 'free',
        pinnedQuestionCount: 0,
        canTakeMovedQuestion: true,
        lockReason: null,
      },
      {
        isReached: false,
        structureEditing: 'free',
        pinnedQuestionCount: 0,
        canTakeMovedQuestion: true,
        lockReason: null,
      },
      {
        isReached: false,
        structureEditing: 'free',
        pinnedQuestionCount: 0,
        canTakeMovedQuestion: true,
        lockReason: null,
      },
    ]);
  });

  it('freezes earlier rounds as reached and pins the opened prefix mid-round', () => {
    const [first, current, next] = describeAt(frontierOf(1, false, [11, 12]));

    expect(first).toEqual({
      isReached: true,
      structureEditing: 'frozen',
      pinnedQuestionCount: 2,
      canTakeMovedQuestion: false,
      lockReason: 'reached',
    });
    expect(current).toEqual({
      isReached: true,
      structureEditing: 'after-opened',
      pinnedQuestionCount: 2,
      canTakeMovedQuestion: true,
      lockReason: null,
    });
    expect(next.isReached).toBe(false);
    expect(next.pinnedQuestionCount).toBe(0);
  });

  it('freezes the current round with its own reason once its block starts locking', () => {
    const [, current, next] = describeAt(frontierOf(1, true, [11, 12]));

    expect(current).toEqual({
      isReached: true,
      structureEditing: 'frozen',
      pinnedQuestionCount: 3,
      canTakeMovedQuestion: false,
      lockReason: 'block-locking',
    });
    expect(next.canTakeMovedQuestion).toBe(true);
  });

  it('keeps later rounds unreached when a session is stepped back with Previous', () => {
    const described = describeAt(frontierOf(0, false, [1, 2, 11]));

    expect(described[0]).toMatchObject({
      isReached: true,
      pinnedQuestionCount: 2,
    });
    expect(described[1]).toMatchObject({
      isReached: false,
      structureEditing: 'free',
      pinnedQuestionCount: 0,
    });
  });

  it('describes two merged sessions by the furthest-on line and every opened question', () => {
    const merged = mergeLiveEditFrontiers([
      frontierOf(0, true, [1]),
      frontierOf(2, false, [1, 2, 11, 12, 13, 21]),
    ]);

    const described = describeAt(merged);

    expect(described.map((round) => round.structureEditing)).toEqual([
      'frozen',
      'frozen',
      'after-opened',
      'free',
    ]);
    expect(described[2].pinnedQuestionCount).toBe(1);
    expect(described.map((round) => round.lockReason)).toEqual([
      'reached',
      'reached',
      null,
      null,
    ]);
  });
});
