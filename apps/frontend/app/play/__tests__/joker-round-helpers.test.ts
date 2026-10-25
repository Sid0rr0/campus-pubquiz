import { describe, expect, it } from 'vitest';
import { isJokerRoundPlayed, jokerExtraPoints } from '@/app/play/joker-round';

describe('jokerExtraPoints', () => {
  it('is the points the joker adds in the joker round', () => {
    expect(jokerExtraPoints(3, 2, 2)).toBe(3);
  });

  it('is null outside the joker round, or with no joker', () => {
    expect(jokerExtraPoints(3, 1, 2)).toBeNull();
    expect(jokerExtraPoints(3, 1, null)).toBeNull();
  });

  it('is null when nothing was earned to double', () => {
    expect(jokerExtraPoints(null, 2, 2)).toBeNull();
    expect(jokerExtraPoints(0, 2, 2)).toBeNull();
  });
});

describe('isJokerRoundPlayed', () => {
  it('is true once a past revealed question belongs to the joker round', () => {
    expect(
      isJokerRoundPlayed(3, 'reveal', [{ roundNumber: 1 }, { roundNumber: 3 }]),
    ).toBe(true);
  });

  it('is false while only other rounds have been revealed', () => {
    expect(isJokerRoundPlayed(3, 'reveal', [{ roundNumber: 1 }])).toBe(false);
    expect(isJokerRoundPlayed(3, 'reveal', [])).toBe(false);
  });

  it('is true once the quiz has ended', () => {
    expect(isJokerRoundPlayed(3, 'ended', [])).toBe(true);
  });
});
