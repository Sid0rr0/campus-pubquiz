import { describe, expect, it } from 'vitest';
import type { ImportQuestionPreview } from '../import';
import {
  QUESTION_KINDS,
  checkQuestion,
  withDerivedPoints,
} from '../question-kind';
import {
  previewToStoredFields,
  rowToSeededQuestion,
} from '../question-record-codec';
import { buildAdminQuestionContext } from '../session-snapshot';
import { toQuestionView } from '../question-view-conversions';
import { isQuickfireAllowedType } from '../scoring';
import { powerUpApplies } from '../power-ups';
import { POWER_UP_IDS } from '../power-ups';

const clues = (
  overrides: Partial<ImportQuestionPreview> = {},
): ImportQuestionPreview => ({
  type: 'clues',
  prompt: 'Who am I?',
  options: ['Vague', 'Sharper', 'Giveaway'],
  answer: 'Einstein',
  points: 99,
  ...overrides,
});

function messages(question: ImportQuestionPreview): string[] {
  const checked = checkQuestion(question);
  return checked.success ? [] : checked.issues.map((issue) => issue.message);
}

describe('the Clue question registry entry', () => {
  it('is typed, graded like free text, and kept out of quickfire and power-ups', () => {
    const kind = QUESTION_KINDS.clues;
    expect(kind.label).toBe('Clue question');
    expect(kind.inputKind).toBe('text');
    expect(kind.gradingMode).toBe(QUESTION_KINDS.free_text.gradingMode);
    expect(kind.revealKind).toBe('answer');
    expect(isQuickfireAllowedType('clues')).toBe(false);
    for (const powerUp of POWER_UP_IDS) {
      expect(powerUpApplies(powerUp, { type: 'clues' })).toBe(false);
    }
    expect(kind.moderatorNote).not.toBe('');
    expect(kind.playerNote).not.toBe('');
  });
});

describe('the clues preview schema', () => {
  it('refuses 1 clue, 9 clues, a pipe in a clue and an empty answer with clear messages', () => {
    expect(messages(clues({ options: ['a'] }))).toEqual([
      'Provide at least 2 clues',
    ]);
    expect(
      messages(
        clues({ options: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] }),
      ),
    ).toEqual(['Provide at most 8 clues']);
    expect(messages(clues({ options: ['a|b', 'c'] }))).toEqual([
      'A clue must not contain "|"',
    ]);
    expect(messages(clues({ answer: '' }))).toEqual(['Missing answer']);
  });

  it.each([2, 5, 8])('accepts %i clues', (count) => {
    const options = Array.from({ length: count }, (_, i) => `clue ${i}`);
    expect(messages(clues({ options }))).toEqual([]);
  });
});

describe('derived points', () => {
  it('stores clues x 0.5 whatever points were given', () => {
    const stored = previewToStoredFields(clues({ points: 99 }));
    expect(stored.points).toBe(1.5);
    expect(stored.payload.options).toEqual(['Vague', 'Sharper', 'Giveaway']);
  });

  it('leaves other types alone', () => {
    const free: ImportQuestionPreview = {
      type: 'free_text',
      prompt: 'Q',
      answer: 'A',
      points: 7,
    };
    expect(withDerivedPoints(free)).toBe(free);
  });
});

describe('no clue leaves the server before the reveal', () => {
  const seeded = rowToSeededQuestion(
    {
      id: 1,
      type: 'clues',
      prompt: 'Who am I?',
      answer: 'Einstein',
      points: 1.5,
    },
    { options: ['Vague', 'Sharper', 'Giveaway'] },
  );

  it('keeps the clues in the seeded question but not in its question view', () => {
    expect(seeded.options).toEqual(['Vague', 'Sharper', 'Giveaway']);
    expect(toQuestionView(seeded)).not.toHaveProperty('options');
  });

  it('keeps them out of the admin question context', () => {
    const context = buildAdminQuestionContext(
      [{ title: 'R', questions: [seeded] } as never],
      1,
    );
    expect(context).not.toHaveProperty('options');
    expect(context?.correctAnswer).toBe('Einstein');
  });
});
