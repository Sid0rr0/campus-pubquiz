import { describe, expect, it } from 'vitest';
import { widenedMargin } from '../margin';
import { powerUpApplies } from '../power-ups';
import { scoreSubmission, withWiderMargin } from '../scoring';

describe('widenedMargin', () => {
  it('doubles the value and keeps the unit', () => {
    expect(widenedMargin({ value: 5, unit: 'percent' })).toEqual({
      value: 10,
      unit: 'percent',
    });
    expect(widenedMargin({ value: 3, unit: 'absolute' })).toEqual({
      value: 6,
      unit: 'absolute',
    });
  });

  it('falls back to the default margin when it is exact-only', () => {
    expect(widenedMargin({ value: 0, unit: 'absolute' })).toEqual({
      value: 10,
      unit: 'percent',
    });
  });
});

describe('withWiderMargin', () => {
  it('doubles the default margin of a Number question with none stored', () => {
    const question = { type: 'number' as const, answer: '100', points: 1 };
    expect(withWiderMargin(question).margin).toEqual({
      value: 20,
      unit: 'percent',
    });
  });
});

describe('wider margin on a Number question', () => {
  const question = {
    type: 'number' as const,
    answer: '100',
    points: 2,
    margin: { value: 5, unit: 'percent' as const },
  };

  it('is offered on number, not on closest guess', () => {
    expect(powerUpApplies('wider_margin', { type: 'number' })).toBe(true);
    expect(powerUpApplies('wider_margin', { type: 'closest_guess' })).toBe(
      false,
    );
  });

  it('grades a guess inside the doubled margin correct only for the widened question', () => {
    expect(scoreSubmission(question, '108').verdict).toBe('incorrect');
    expect(scoreSubmission(withWiderMargin(question), '108').verdict).toBe(
      'correct',
    );
  });
});
