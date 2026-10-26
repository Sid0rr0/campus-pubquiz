import { describe, expect, it } from 'vitest';
import { scoreSubmission } from '../scoring';

describe('scoreSubmission — pinned base scores for every question type', () => {
  it.each([
    ['free_text', 'queen', 'Queen', undefined, 10, 'correct'],
    ['free_text', ' QUEEN ', 'Queen', undefined, 10, 'correct'],
    ['free_text', 'Kings', 'Queen', undefined, 0, 'incorrect'],
    ['free_text', '', 'Queen', undefined, 0, 'incorrect'],
    ['multiple_choice', 'Paris', 'Paris', undefined, 10, 'correct'],
    ['multiple_choice', 'Paris ', 'Paris', undefined, 0, 'incorrect'],
    ['sort', ' a ||b| c ', 'a|b|c', undefined, 10, 'correct'],
    ['sort', '', 'a|b|c', undefined, 0, 'incorrect'],
    ['match', 'x|y', 'x|y', 'per_item', 10, 'correct'],
    ['match', 'x|z', 'x|y', 'per_item', 5, 'partial'],
    ['match', 'q|z', 'x|y', 'per_item', 0, 'incorrect'],
    ['match', 'x|y|z|w', 'x|y|z|w', 'one_off', 10, 'correct'],
    ['match', 'x|y|z|q', 'x|y|z|w', 'one_off', 5, 'partial'],
    ['match', 'x|y|q|q', 'x|y|z|w', 'one_off', 0, 'incorrect'],
    ['match', 'x|z', 'x|y', undefined, 5, 'partial'],
  ] as const)(
    '%s: %j against %j (%s) -> %i, %s',
    (type, value, answer, scoringMode, points, verdict) => {
      expect(
        scoreSubmission({ type, answer, points: 10, scoringMode }, value),
      ).toEqual({ points, verdict });
    },
  );
});
