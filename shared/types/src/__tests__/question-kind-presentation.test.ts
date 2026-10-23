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

/** The `/guide` copy per type, pinned so an accidental edit shows up in review. */
const MODERATOR_NOTES = {
  multiple_choice:
    'Options are separated by pipes (Paris|London|Berlin) and the answer must match one option exactly. Graded automatically when a team submits; you can override by hand.',
  free_text:
    'No options. An answer matching the answer text (case and whitespace are ignored) is graded correct when a team submits; any other answer waits for you to grade it, and you can override any mark by hand.',
  sort: 'Options are pipe-separated in any order and the answer lists them in the correct order. Graded automatically when a team submits; you can override by hand.',
  match:
    'Options hold both lists as left1|left2+right1|right2 and the answer pairs them (Paris+France|Tokyo+Japan). Graded automatically when a team submits; you can override by hand.',
  closest_guess:
    'The answer is a number. Graded in one batch once the block locks: every team tied for the closest guess gets full points and everyone else gets zero. From then on you can override any mark by hand.',
  number:
    'The answer is a number, and the question carries a margin (10% of the answer unless the editor says otherwise). An answer within the margin, edges included, is graded correct when a team submits; anything else is graded incorrect. Teams answer on a number keypad, and you can override any mark by hand.',
} as const;

describe('question kind presentation', () => {
  it.each(QUESTION_TYPES)('%s carries its moderator note', (type) => {
    expect(QUESTION_KINDS[type].moderatorNote).toBe(MODERATOR_NOTES[type]);
  });

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
