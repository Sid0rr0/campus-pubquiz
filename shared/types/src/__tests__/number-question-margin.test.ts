import { describe, expect, it } from 'vitest';
import type { ImportQuestionPreview } from '../import';
import { QUESTION_KINDS, checkQuestion } from '../question-kind';
import { isWithinMargin } from '../margin';
import { QUESTION_TYPES } from '../question-types';

describe('which question types carry a margin', () => {
  it('is Number alone', () => {
    const withMargin = QUESTION_TYPES.filter(
      (type) => QUESTION_KINDS[type].hasMargin,
    );

    expect(withMargin).toEqual(['number']);
  });
});

function numberQuestion(
  overrides: Partial<ImportQuestionPreview> = {},
): ImportQuestionPreview {
  return {
    type: 'number',
    prompt: 'How tall is the Eiffel Tower in metres?',
    answer: '330',
    points: 1,
    ...overrides,
  };
}

function messages(question: ImportQuestionPreview): string[] {
  const checked = checkQuestion(question);
  return checked.success ? [] : checked.issues.map((issue) => issue.message);
}

describe('Number question validation', () => {
  it('fills in a 10% margin when none is given', () => {
    const checked = checkQuestion(numberQuestion());

    expect(checked).toEqual({
      success: true,
      data: { ...numberQuestion(), margin: { value: 10, unit: 'percent' } },
    });
  });

  it('keeps a margin the author chose', () => {
    const margin = { value: 2.5, unit: 'absolute' } as const;

    expect(checkQuestion(numberQuestion({ margin }))).toEqual({
      success: true,
      data: { ...numberQuestion(), margin },
    });
  });

  it('accepts a margin of 0 and a percentage of exactly 100', () => {
    expect(
      messages(numberQuestion({ margin: { value: 0, unit: 'absolute' } })),
    ).toEqual([]);
    expect(
      messages(numberQuestion({ margin: { value: 100, unit: 'percent' } })),
    ).toEqual([]);
  });

  it('accepts an absolute margin over 100', () => {
    expect(
      messages(numberQuestion({ margin: { value: 500, unit: 'absolute' } })),
    ).toEqual([]);
  });

  it('rejects a negative margin', () => {
    expect(
      messages(numberQuestion({ margin: { value: -1, unit: 'absolute' } })),
    ).toEqual(['Margin must not be negative']);
  });

  it('rejects a percentage over 100', () => {
    expect(
      messages(numberQuestion({ margin: { value: 101, unit: 'percent' } })),
    ).toEqual(['A percentage margin must be at most 100']);
  });

  it('rejects an answer that is not a finite number with the closest guess message', () => {
    const closestGuess = checkQuestion({
      ...numberQuestion(),
      type: 'closest_guess',
      answer: 'lots',
    });

    expect(messages(numberQuestion({ answer: 'lots' }))).toEqual(
      closestGuess.success ? [] : closestGuess.issues.map((i) => i.message),
    );
    expect(messages(numberQuestion({ answer: 'lots' }))).toEqual([
      'Answer must be a number',
    ]);
  });

  it('rejects a whitespace-only answer for Number and closest guess alike', () => {
    expect(messages(numberQuestion({ answer: '  ' }))).toEqual([
      'Answer must be a number',
    ]);
    expect(
      messages({ ...numberQuestion({ answer: '  ' }), type: 'closest_guess' }),
    ).toEqual(['Answer must be a number']);
  });
});

describe('isWithinMargin at margin 0', () => {
  const exact = { value: 0, unit: 'absolute' } as const;

  it('accepts only the exact key, with no float slack', () => {
    expect(isWithinMargin(0.5, 0.5, exact)).toBe(true);
    expect(isWithinMargin(1, 1 + Number.EPSILON, exact)).toBe(false);
    expect(isWithinMargin(1e6, 1e6 + 1e-9, exact)).toBe(false);
    expect(
      isWithinMargin(100, 100.0000001, { value: 0, unit: 'percent' }),
    ).toBe(false);
  });

  it('still counts an answer on the edge of a positive margin', () => {
    expect(isWithinMargin(0.5, 0.55, { value: 0.05, unit: 'absolute' })).toBe(
      true,
    );
  });
});
