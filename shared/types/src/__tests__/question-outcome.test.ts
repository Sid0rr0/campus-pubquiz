import { describe, expect, it } from 'vitest';
import { questionOutcome } from '../question-outcome';

const correct = (pointsAwarded = 1000) => ({
  verdict: 'correct' as const,
  pointsAwarded,
});
const partial = (pointsAwarded: number) => ({
  verdict: 'partial' as const,
  pointsAwarded,
});
const incorrect = { verdict: 'incorrect' as const, pointsAwarded: 0 };
const ungraded = { verdict: null, pointsAwarded: 0 };

const match = { type: 'match' as const, points: 1000 };

describe('questionOutcome', () => {
  it('counts correct, partial and incorrect separately, and an ungraded answer as answered only', () => {
    const outcome = questionOutcome(
      match,
      [correct(), correct(), partial(500), incorrect, ungraded],
      10,
    );
    expect(outcome.answeredCount).toBe(5);
    expect(outcome.correctCount).toBe(2);
    expect(outcome.partialCount).toBe(1);
  });

  it('adds a partial answer by its points share, clamped to 0-1', () => {
    expect(questionOutcome(match, [partial(250)], 1).correctRate).toBe(0.25);
    expect(questionOutcome(match, [partial(5000)], 1).correctRate).toBe(1);
    expect(questionOutcome(match, [partial(-50)], 1).correctRate).toBe(0);
  });

  it('adds a speed-scaled correct answer as 1', () => {
    expect(questionOutcome(match, [correct(300)], 2).correctRate).toBe(0.5);
  });

  it('has counts but no rate for a closest guess', () => {
    const outcome = questionOutcome(
      { type: 'closest_guess', points: 1000 },
      [correct(), incorrect],
      4,
    );
    expect(outcome).toEqual({
      answeredCount: 2,
      correctCount: 1,
      partialCount: 0,
      correctRate: null,
    });
  });

  it('has no rate when the team count is 0', () => {
    expect(questionOutcome(match, [correct()], 0).correctRate).toBeNull();
  });

  it('has zero counts and a rate of 0 when nobody answered', () => {
    expect(questionOutcome(match, [], 5)).toEqual({
      answeredCount: 0,
      correctCount: 0,
      partialCount: 0,
      correctRate: 0,
    });
  });

  it('divides by the team count, so teams that did not answer lower the rate', () => {
    expect(questionOutcome(match, [correct(), correct()], 8).correctRate).toBe(
      0.25,
    );
  });
});
