import { describe, expect, it } from 'vitest';
import { scoreSubmission } from '../scoring';

describe('scoreSubmission — pinned base scores for every question type', () => {
  it.each([
    ['free_text', 'queen', 'Queen', undefined, 10, 'correct'],
    ['audio', ' QUEEN ', 'Queen', undefined, 10, 'correct'],
    ['audio', 'Kings', 'Queen', undefined, 0, 'incorrect'],
    ['youtube', 'queen', 'Queen', undefined, 10, 'correct'],
    ['youtube', '', 'Queen', undefined, 0, 'incorrect'],
    ['multiple_choice', 'Paris', 'Paris', undefined, 10, 'correct'],
    ['multiple_choice', 'Paris ', 'Paris', undefined, 0, 'incorrect'],
    ['sort', ' a ||b| c ', 'a|b|c', undefined, 10, 'correct'],
    ['sort', '', 'a|b|c', undefined, 0, 'incorrect'],
    ['match', 'x|y', 'x|y', 'partial', 10, 'correct'],
    ['match', 'x|z', 'x|y', 'partial', 5, 'partial'],
    ['match', 'q|z', 'x|y', 'partial', 0, 'incorrect'],
    ['match', 'x|y|z|w', 'x|y|z|w', 'all_or_nothing', 10, 'correct'],
    ['match', 'x|y|z|q', 'x|y|z|w', 'all_or_nothing', 5, 'partial'],
    ['match', 'x|y|q|q', 'x|y|z|w', 'all_or_nothing', 0, 'incorrect'],
    ['match', 'x|z', 'x|y', undefined, 5, 'partial'],
    ['closest_guess', '5', '5', undefined, 0, 'incorrect'],
  ] as const)(
    '%s: %j against %j (%s) -> %i, %s',
    (type, value, answer, matchScoringMode, points, verdict) => {
      expect(
        scoreSubmission({ type, answer, points: 10, matchScoringMode }, value),
      ).toEqual({ points, verdict });
    },
  );
});
