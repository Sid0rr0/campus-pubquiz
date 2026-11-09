import { describe, expect, it } from 'vitest';
import {
  clueValue,
  clueValueFromPoints,
  cluePoints,
  clueValues,
} from '../clue-value';
import { atClue, scoreSubmission } from '../scoring';

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

  it('reads a clue value from the question points alone', () => {
    expect(clueValueFromPoints(2.5, 3)).toBe(1.5);
  });
});

describe('grading a Clue answer at its clue', () => {
  const clues = {
    type: 'clues' as const,
    answer: 'Marie Curie',
    points: 2.5,
    options: ['a', 'b', 'c', 'd', 'e'],
  };

  it('sets the points to the clue value', () => {
    expect(atClue(clues, 2).points).toBe(2);
    expect(scoreSubmission(atClue(clues, 4), 'marie curie')).toEqual({
      points: 1,
      verdict: 'correct',
    });
  });

  it('leaves a question without a clue, or another type, as it is', () => {
    expect(atClue(clues, null)).toBe(clues);
    const freeText = { type: 'free_text' as const, answer: 'x', points: 2 };
    expect(atClue(freeText, 3)).toBe(freeText);
  });
});
