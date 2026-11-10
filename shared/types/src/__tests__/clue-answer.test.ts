import { describe, expect, it } from 'vitest';
import { isNonAnswer } from '../answers';
import { clueFreezeState, clueToRecord, clueWorth } from '../clue-answer';

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

describe('clueFreezeState', () => {
  const four = { type: 'clues' as const, clueCount: 4 };
  const answer = (value: string | undefined, clue: number | undefined) => ({
    value,
    clue,
  });

  it('is not frozen before a new clue, and can still freeze', () => {
    expect(clueFreezeState(four, answer('x', 2), 2)).toEqual({
      isFrozen: false,
      isFreezable: true,
    });
  });

  it('is frozen once a new clue was shown', () => {
    expect(clueFreezeState(four, answer('x', 1), 2).isFrozen).toBe(true);
  });

  it.each(['', '__idk__'])('never freezes a %j answer', (cleared) => {
    expect(clueFreezeState(four, answer(cleared, 1), 3).isFrozen).toBe(false);
  });

  it('is not frozen without an answer or a recorded clue', () => {
    expect(
      clueFreezeState(four, answer(undefined, undefined), 3).isFrozen,
    ).toBe(false);
    expect(clueFreezeState(four, answer('x', undefined), 3).isFrozen).toBe(
      false,
    );
  });

  it('cannot freeze on the last clue', () => {
    expect(clueFreezeState(four, answer('x', 4), 4).isFreezable).toBe(false);
  });

  it('is never frozen or freezable for a type without clues', () => {
    expect(clueFreezeState({ type: 'free_text' }, answer('x', 1), 3)).toEqual({
      isFrozen: false,
      isFreezable: false,
    });
  });

  it.each([
    ['x', 1, 2],
    ['x', 2, 2],
    ['', 1, 3],
    ['__idk__', 1, 3],
    ['x', 3, 4],
  ])(
    'agrees with clueToRecord for %j on clue %i of %i',
    (value, clue, high) => {
      const changed = `${value}!`;
      expect(clueFreezeState(four, answer(value, clue), high).isFrozen).toBe(
        clueToRecord(clues, stored(value, clue), changed, high) === 'frozen' &&
          !isNonAnswer(value),
      );
    },
  );
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
