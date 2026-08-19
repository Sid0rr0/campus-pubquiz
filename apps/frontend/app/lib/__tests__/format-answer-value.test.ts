import { describe, expect, it } from 'vitest';
import { formatAnswerValue } from '@/app/lib/format-answer-value';

describe('formatAnswerValue', () => {
  it('returns free-text/multiple-choice values unchanged', () => {
    expect(formatAnswerValue('Paris', 'free_text')).toBe('Paris');
    expect(formatAnswerValue('Paris', 'multiple_choice')).toBe('Paris');
  });

  it('formats a sort answer as an arrow chain', () => {
    expect(formatAnswerValue('Mercury|Venus|Earth', 'sort')).toBe(
      'Mercury → Venus → Earth',
    );
  });

  it('pairs each match right-hand value with its left item when leftItems is given', () => {
    expect(
      formatAnswerValue('excalibur|shield', 'match', [
        'arthur',
        'captain america',
      ]),
    ).toBe('arthur → excalibur, captain america → shield');
  });

  it('falls back to a bare arrow chain for match when leftItems is missing', () => {
    expect(formatAnswerValue('excalibur|shield', 'match')).toBe(
      'excalibur → shield',
    );
  });

  it('falls back to a bare arrow chain for match when leftItems length disagrees', () => {
    expect(formatAnswerValue('excalibur|shield', 'match', ['arthur'])).toBe(
      'excalibur → shield',
    );
  });
});
