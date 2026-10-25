import { describe, expect, it } from 'vitest';
import type { QuizPreviewStep } from '@campus-pubquiz/types';
import {
  previewPosition,
  stepIndexAt,
  stepPosition,
} from '@/app/lib/quiz-preview-position';

/** Only the fields a position is read from. */
function step(
  kind: string,
  roundIndex: number,
  questionIndex: number | null,
): QuizPreviewStep {
  return {
    roundIndex,
    questionIndex,
    screen: { kind },
  } as unknown as QuizPreviewStep;
}

describe('previewPosition', () => {
  it('numbers rounds and questions from 1', () => {
    expect(previewPosition(1)).toBe('r2');
    expect(previewPosition(1, 2)).toBe('r2q3');
  });
});

describe('stepPosition', () => {
  it.each([
    ['round_title', 'r2'],
    ['question', 'r2q3'],
    ['reveal', 'r2q3-answer'],
    ['reveal_intro', 'r2q3-reveals'],
    ['break_intro', 'r2q3-break'],
    ['round_overview', 'r2q3-overview'],
    ['joker_pick', 'r2q3-jokers'],
  ])('writes a %s step as %s', (kind, expected) => {
    const questionIndex = kind === 'round_title' ? null : 2;
    expect(stepPosition(step(kind, 1, questionIndex))).toBe(expected);
  });
});

describe('stepIndexAt', () => {
  const steps = [
    step('round_title', 0, null),
    step('question', 0, 0),
    step('reveal', 0, 0),
    step('question', 1, 0),
  ];

  it('finds the step a position names', () => {
    expect(stepIndexAt(steps, 'r1q1-answer')).toBe(2);
    expect(stepIndexAt(steps, 'r2q1')).toBe(3);
  });

  it('falls back to the first step for an absent, unknown or malformed position', () => {
    expect(stepIndexAt(steps, null)).toBe(0);
    expect(stepIndexAt(steps, 'r9q9')).toBe(0);
    expect(stepIndexAt(steps, 'nonsense')).toBe(0);
  });
});
