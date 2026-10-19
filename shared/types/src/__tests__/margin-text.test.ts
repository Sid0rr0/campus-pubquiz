import { describe, expect, it } from 'vitest';
import {
  formatAcceptedRange,
  formatMarginText,
  formatNumberReveal,
} from '../margin';
import { toQuestionView } from '../question-view-conversions';
import type { SeededQuestion } from '../question-views';

describe('formatMarginText', () => {
  it('words a percent margin', () => {
    expect(formatMarginText({ value: 5, unit: 'percent' })).toBe(
      'Answers within 5% of the real number count as correct',
    );
  });

  it('keeps up to two decimals', () => {
    expect(formatMarginText({ value: 2.5, unit: 'percent' })).toBe(
      'Answers within 2.5% of the real number count as correct',
    );
    expect(formatMarginText({ value: 2.456, unit: 'percent' })).toBe(
      'Answers within 2.46% of the real number count as correct',
    );
  });

  it('words an absolute margin without a unit sign', () => {
    expect(formatMarginText({ value: 5, unit: 'absolute' })).toBe(
      'Answers within 5 of the real number count as correct',
    );
  });

  it('says only the exact answer counts for margin 0', () => {
    expect(formatMarginText({ value: 0, unit: 'percent' })).toBe(
      'Exact answer only',
    );
    expect(formatMarginText({ value: 0, unit: 'absolute' })).toBe(
      'Exact answer only',
    );
  });
});

describe('formatAcceptedRange', () => {
  it('spans key minus to key plus the allowed distance', () => {
    expect(formatAcceptedRange(200, { value: 10, unit: 'percent' })).toBe(
      '180–220',
    );
  });

  it('rounds each end to two decimals', () => {
    expect(formatAcceptedRange(1969, { value: 10, unit: 'percent' })).toBe(
      '1772.1–2165.9',
    );
  });

  it('orders a negative key low to high', () => {
    expect(formatAcceptedRange(-200, { value: 10, unit: 'percent' })).toBe(
      '-220–-180',
    );
  });

  it('gives a single value for margin 0', () => {
    expect(formatAcceptedRange(42, { value: 0, unit: 'absolute' })).toBe('42');
  });
});

describe('formatNumberReveal', () => {
  it('shows the key and the accepted range', () => {
    expect(formatNumberReveal('200', { value: 10, unit: 'percent' })).toBe(
      '200 (anything from 180 to 220 counts)',
    );
  });

  it('shows just the key for margin 0', () => {
    expect(formatNumberReveal('200', { value: 0, unit: 'percent' })).toBe(
      '200',
    );
  });

  it('shows the key as typed when it is not a number', () => {
    expect(formatNumberReveal('lots', { value: 10, unit: 'percent' })).toBe(
      'lots',
    );
  });
});

describe('toQuestionView margin', () => {
  const base: SeededQuestion = {
    id: 1,
    type: 'number',
    prompt: 'How many?',
    points: 1,
    answer: '200',
  };

  it('carries a Number question margin and not the answer', () => {
    const margin = { value: 5, unit: 'absolute' as const };

    const view = toQuestionView({ ...base, margin });

    expect(view.margin).toEqual(margin);
    expect(view).not.toHaveProperty('answer');
  });

  it('gives other types no margin', () => {
    const view = toQuestionView({
      ...base,
      type: 'closest_guess',
      margin: { value: 5, unit: 'absolute' },
    });

    expect(view).not.toHaveProperty('margin');
  });
});
