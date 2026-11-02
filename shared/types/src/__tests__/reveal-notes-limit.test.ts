import { describe, expect, it } from 'vitest';
import { checkQuestion } from '../question-kind';
import { REVEAL_NOTES_MAX_LENGTH } from '../round-note';

const question = (notes: string, showNotesAtReveal: boolean) => ({
  type: 'free_text',
  prompt: 'Q?',
  answer: 'A',
  points: 1,
  notes,
  showNotesAtReveal,
});

describe('checkQuestion, notes shown at the reveal', () => {
  const longest = 'x'.repeat(REVEAL_NOTES_MAX_LENGTH);

  it('accepts notes at the limit', () => {
    expect(checkQuestion(question(longest, true)).success).toBe(true);
  });

  it('rejects notes over the limit on the notes field', () => {
    expect(checkQuestion(question(`${longest}x`, true))).toEqual({
      success: false,
      issues: [
        {
          path: ['notes'],
          code: 'custom',
          message: 'Notes shown at the reveal must be at most 500 characters',
        },
      ],
    });
  });

  it('leaves long notes alone when they stay host-only', () => {
    expect(checkQuestion(question(`${longest}x`, false)).success).toBe(true);
  });

  it('measures the notes without their settings group', () => {
    expect(
      checkQuestion(question(`${longest}\n{start: "0:05"}`, true)).success,
    ).toBe(true);
  });
});
