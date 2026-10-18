import { describe, expect, it } from 'vitest';
import { QUESTION_KINDS } from '../question-kind';
import { QUESTION_TYPES } from '../question-types';

const EXPECTED = {
  multiple_choice: { label: 'Multiple choice', inputKind: 'choice' },
  free_text: { label: 'Free text', inputKind: 'text' },
  sort: { label: 'Sort / order', inputKind: 'sort' },
  match: { label: 'Match pairs', inputKind: 'match' },
  closest_guess: { label: 'Closest guess', inputKind: 'number' },
  number: { label: 'Number', inputKind: 'number' },
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

  it.each(QUESTION_TYPES)('%s declares its label and input kind', (type) => {
    const { label, inputKind } = QUESTION_KINDS[type];
    expect({ label, inputKind }).toEqual(EXPECTED[type]);
  });
});
