import { describe, expect, it } from 'vitest';
import {
  answerCredit,
  hasMeaningfulCorrectRate,
} from '../question-correct-rate';
import { QUESTION_TYPES } from '../question-types';

describe('answerCredit', () => {
  it('counts a correct answer in full, whatever its points', () => {
    expect(answerCredit({ verdict: 'correct', pointsAwarded: 400 }, 1000)).toBe(
      1,
    );
  });

  it('counts a partial answer as its points share of the question', () => {
    expect(answerCredit({ verdict: 'partial', pointsAwarded: 250 }, 1000)).toBe(
      0.25,
    );
  });

  it('clamps a partial share to 0-1', () => {
    expect(
      answerCredit({ verdict: 'partial', pointsAwarded: 2000 }, 1000),
    ).toBe(1);
    expect(answerCredit({ verdict: 'partial', pointsAwarded: -50 }, 1000)).toBe(
      0,
    );
  });

  it('counts a partial answer on a question worth no points as nothing', () => {
    expect(answerCredit({ verdict: 'partial', pointsAwarded: 10 }, 0)).toBe(0);
  });

  it('counts incorrect and ungraded answers as nothing', () => {
    expect(answerCredit({ verdict: 'incorrect', pointsAwarded: 0 }, 1000)).toBe(
      0,
    );
    expect(answerCredit({ verdict: null, pointsAwarded: 0 }, 1000)).toBe(0);
  });

  it('counts nothing for a non-partial verdict even when points were awarded', () => {
    expect(
      answerCredit({ verdict: 'incorrect', pointsAwarded: 500 }, 1000),
    ).toBe(0);
    expect(answerCredit({ verdict: null, pointsAwarded: 500 }, 1000)).toBe(0);
  });
});

describe('hasMeaningfulCorrectRate', () => {
  it('is false only for a closest guess, which has one winner by design', () => {
    const without = QUESTION_TYPES.filter(
      (type) => !hasMeaningfulCorrectRate(type),
    );
    expect(without).toEqual(['closest_guess']);
  });
});
