import { describe, expect, it } from 'vitest';
import { clueToRecord, clueWorth } from '../clue-answer';

const clues = { type: 'clues' as const };
const freeText = { type: 'free_text' as const };
const stored = (value: string, clue: number | null) => ({ value, clue });

describe('clueToRecord', () => {
  it('records a first answer on the highest clue shown, clue 1 when none', () => {
    expect(clueToRecord(clues, null, 'x', 1)).toBe(1);
    expect(clueToRecord(clues, null, 'x', 4)).toBe(4);
    expect(clueToRecord(clues, null, 'x', null)).toBe(1);
  });

  it('keeps the clue of an unchanged resend after a new clue', () => {
    expect(clueToRecord(clues, stored('x', 1), 'x', 4)).toBe(1);
  });

  it('re-records a changed value on the same clue', () => {
    expect(clueToRecord(clues, stored('x', 3), 'y', 3)).toBe(3);
  });

  it('freezes a changed value after a new clue, even a blank', () => {
    expect(clueToRecord(clues, stored('x', 1), 'y', 2)).toBe('frozen');
    expect(clueToRecord(clues, stored('x', 1), '', 2)).toBe('frozen');
  });

  it.each(['', '__idk__'])('never freezes a stored %j', (cleared) => {
    expect(clueToRecord(clues, stored(cleared, 1), 'y', 1)).toBe(1);
    expect(clueToRecord(clues, stored(cleared, 1), 'y', 3)).toBe(3);
  });

  it('treats a stored answer without a clue as recorded on the highest', () => {
    expect(clueToRecord(clues, stored('x', null), 'y', 3)).toBe(3);
  });

  it('records null for a type without clues', () => {
    expect(clueToRecord(freeText, null, 'x', 3)).toBeNull();
    expect(clueToRecord(freeText, stored('x', 1), 'y', 3)).toBeNull();
  });
});

describe('clueWorth', () => {
  it.each([
    [2, [1, 0.5]],
    [8, [4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5]],
  ])('%i clues are worth %j', (count, values) => {
    values.forEach((value, index) => {
      expect(clueWorth(count, index + 1)).toBe(value);
    });
  });
});
