import { describe, expect, it } from 'vitest';
import { QUESTION_KINDS } from '../question-kind';
import { QUESTION_TYPES } from '../question-types';

const EXPECTED = {
  multiple_choice: {
    label: 'Multiple choice',
    inputKind: 'choice',
    requiresMedia: false,
  },
  free_text: { label: 'Free text', inputKind: 'text', requiresMedia: false },
  sort: { label: 'Sort / order', inputKind: 'sort', requiresMedia: false },
  match: { label: 'Match pairs', inputKind: 'match', requiresMedia: false },
  closest_guess: {
    label: 'Closest guess',
    inputKind: 'number',
    requiresMedia: false,
  },
  number: { label: 'Number', inputKind: 'number', requiresMedia: false },
} as const;

describe('question kind presentation', () => {
  it('lists exactly the six types, in the editor picker order', () => {
    expect([...QUESTION_TYPES]).toEqual([
      'multiple_choice',
      'free_text',
      'sort',
      'match',
      'closest_guess',
      'number',
    ]);
    expect([...QUESTION_TYPES]).toEqual(Object.keys(EXPECTED));
  });

  it.each(QUESTION_TYPES)(
    '%s declares its label, input kind and media need',
    (type) => {
      const { label, inputKind, requiresMedia } = QUESTION_KINDS[type];
      expect({ label, inputKind, requiresMedia }).toEqual(EXPECTED[type]);
    },
  );
});
