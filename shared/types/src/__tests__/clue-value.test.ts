import { describe, expect, it } from 'vitest';
import { clueValue, cluePoints, clueValues } from '../clue-value';

describe('clue value', () => {
  it.each([
    [5, [2.5, 2, 1.5, 1, 0.5]],
    [4, [2, 1.5, 1, 0.5]],
    [3, [1.5, 1, 0.5]],
    [2, [1, 0.5]],
  ])('%i clues are worth %j', (count, values) => {
    expect(clueValues(count)).toEqual(values);
    values.forEach((value, index) => {
      expect(clueValue(count, index + 1)).toBe(value);
    });
  });

  it('stores the first-clue value as the question points', () => {
    expect(cluePoints(5)).toBe(2.5);
    expect(cluePoints(2)).toBe(1);
  });
});
