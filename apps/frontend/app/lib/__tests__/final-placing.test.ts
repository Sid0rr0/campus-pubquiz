import { describe, expect, test } from 'vitest';
import { describeFinalPlacing, isPodiumRank } from '@/app/lib/final-placing';

const entry = (teamId: number, rank: number, rankTo = rank) => ({
  teamId,
  rank,
  rankTo,
});

describe('describeFinalPlacing', () => {
  test('names a plain rank out of the field', () => {
    const board = [entry(1, 1), entry(2, 2), entry(3, 3), entry(4, 4)];

    expect(describeFinalPlacing(board, 4)).toEqual({
      text: 'You finished 4th of 4',
      rank: 4,
    });
  });

  test('says Joint for a tie group', () => {
    const board = [entry(1, 1), entry(2, 2, 3), entry(3, 2, 3), entry(4, 4)];

    expect(describeFinalPlacing(board, 3)?.text).toBe(
      'You finished Joint 2nd of 4',
    );
  });

  test('uses 11th, 12th and 13th, 21st and 22nd correctly', () => {
    const board = Array.from({ length: 22 }, (_, index) =>
      entry(index + 1, index + 1),
    );

    expect(describeFinalPlacing(board, 11)?.text).toBe(
      'You finished 11th of 22',
    );
    expect(describeFinalPlacing(board, 12)?.text).toBe(
      'You finished 12th of 22',
    );
    expect(describeFinalPlacing(board, 13)?.text).toBe(
      'You finished 13th of 22',
    );
    expect(describeFinalPlacing(board, 21)?.text).toBe(
      'You finished 21st of 22',
    );
    expect(describeFinalPlacing(board, 22)?.text).toBe(
      'You finished 22nd of 22',
    );
  });

  test('returns null when the team is not on the board', () => {
    expect(describeFinalPlacing([entry(1, 1)], 9)).toBeNull();
    expect(describeFinalPlacing([entry(1, 1)], null)).toBeNull();
  });
});

describe('isPodiumRank', () => {
  test('is true for ranks 1 to 3 only', () => {
    expect([1, 2, 3, 4].map(isPodiumRank)).toEqual([true, true, true, false]);
  });
});
