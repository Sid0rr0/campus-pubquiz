import { describe, expect, it } from 'vitest';
import {
  isRoundStructureFrozen,
  mergeLiveEditFrontiers,
} from '../live-edit-frontier';

describe('mergeLiveEditFrontiers', () => {
  it('takes the further-on session’s current round as the line', () => {
    const merged = mergeLiveEditFrontiers([
      { openedQuestionIds: [1, 2], currentRoundIndex: 0 },
      { openedQuestionIds: [1, 2, 3, 4], currentRoundIndex: 2 },
    ]);

    expect(merged.currentRoundIndex).toBe(2);
  });

  it('unions the opened question ids without duplicates', () => {
    const merged = mergeLiveEditFrontiers([
      { openedQuestionIds: [1, 2], currentRoundIndex: 0 },
      { openedQuestionIds: [2, 3], currentRoundIndex: 1 },
    ]);

    expect(merged.openedQuestionIds).toEqual([1, 2, 3]);
  });
});

describe('isRoundStructureFrozen', () => {
  const frontier = { openedQuestionIds: [], currentRoundIndex: 1 };

  it.each([
    [0, true],
    [1, true],
    [2, false],
    [5, false],
  ])('round %i frozen: %s', (roundIndex, expected) => {
    expect(isRoundStructureFrozen(frontier, roundIndex)).toBe(expected);
  });
});
