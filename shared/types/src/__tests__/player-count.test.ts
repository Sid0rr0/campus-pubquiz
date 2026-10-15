import { describe, expect, it } from 'vitest';
import { isValidPlayerCount } from '../player-count';

describe('isValidPlayerCount', () => {
  it.each([1, 4, 20])('accepts the whole number %s', (count) => {
    expect(isValidPlayerCount(count)).toBe(true);
  });

  it.each([0, 21, -3, 2.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses %s',
    (count) => {
      expect(isValidPlayerCount(count)).toBe(false);
    },
  );
});
