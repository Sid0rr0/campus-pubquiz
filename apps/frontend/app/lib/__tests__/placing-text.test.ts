import { describe, expect, it } from 'vitest';
import { ordinal, placingText } from '@/app/lib/placing-text';

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [22, '22nd'],
    [112, '112th'],
  ])('writes %i as %s', (n, expected) => {
    expect(ordinal(n)).toBe(expected);
  });
});

describe('placingText', () => {
  it('says "You\'re 4th" for a clear place', () => {
    expect(placingText({ rank: 4, rankTo: 4 })).toBe("You're 4th");
  });

  it('says "Joint 2nd" for a tie group, from its competition rank', () => {
    expect(placingText({ rank: 2, rankTo: 3 })).toBe('Joint 2nd');
  });

  it('lets the caller word a clear place and keeps "Joint" for a tie', () => {
    const finished = (place: string) => `You finished ${place} of 12`;

    expect(placingText({ rank: 4, rankTo: 4 }, finished)).toBe(
      'You finished 4th of 12',
    );
    expect(placingText({ rank: 2, rankTo: 2 }, finished)).toBe(
      'You finished 2nd of 12',
    );
    expect(placingText({ rank: 2, rankTo: 3 }, finished)).toBe('Joint 2nd');
  });
});
