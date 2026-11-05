import { describe, expect, it } from 'vitest';
import {
  isPinOffPlace,
  askTheRoomSplit,
  removedOptionsOf,
  POWER_UP_DESCRIPTIONS,
} from '../power-ups';
import { QUESTION_KINDS } from '../question-kind';
import { SCORING_MODE_LABELS } from '../scoring-mode';
import { SESSION_SCALE_QUESTIONS } from '../session-scales';
import { parseMarginCell, parseNotesGroup } from '../notes-group';

describe('player-facing copy is never blank', () => {
  it.each([
    ['power-up descriptions', Object.values(POWER_UP_DESCRIPTIONS)],
    ['scoring mode labels', Object.values(SCORING_MODE_LABELS)],
    ['session scale questions', Object.values(SESSION_SCALE_QUESTIONS)],
    [
      'question player notes',
      Object.values(QUESTION_KINDS).map((k) => k.playerNote),
    ],
  ])('%s', (_name, texts) => {
    for (const text of texts) expect(text.trim()).not.toBe('');
  });
});

describe('parseMarginCell is anchored and takes full decimals', () => {
  it.each(['x5', '5x', '5%x', '1.'])('rejects %j', (raw) => {
    expect(parseMarginCell(raw)).toBeUndefined();
  });
  it('reads a multi-digit decimal', () => {
    expect(parseMarginCell('1.25')).toEqual({ value: 1.25, unit: 'absolute' });
  });
});

describe('the legacy clip prefix', () => {
  it('is removed with a tab or spaces before the group', () => {
    expect(parseNotesGroup('YouTube clip:\t {start: 5}').freeNotes).toBe('');
    expect(parseNotesGroup('YouTube clip:  {start: 5}').freeNotes).toBe('');
  });
});

describe('isPinOffPlace', () => {
  it('is false for an answer that is no list, even with a pin', () => {
    expect(isPinOffPlace('text', 'abc', { item: 'a', position: 0 })).toBe(
      false,
    );
  });
});

describe('askTheRoomSplit', () => {
  it('gives the leftover point to the earliest option on a tie', () => {
    expect(askTheRoomSplit(['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual({
      a: 34,
      b: 33,
      c: 33,
    });
  });
});

describe('askTheRoomSplit leftovers', () => {
  it('hands the leftover points to the earliest options when remainders tie', () => {
    const options = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    expect(askTheRoomSplit(options, options)).toEqual({
      a: 15,
      b: 15,
      c: 14,
      d: 14,
      e: 14,
      f: 14,
      g: 14,
    });
  });
});

describe('removedOptionsOf', () => {
  it('is empty when no 50/50 was bought on that question', () => {
    const purchases = [
      { questionId: 2, effect: { kind: 'fifty_fifty', removedOptions: ['x'] } },
    ] as never;
    expect(removedOptionsOf(1, purchases)).toEqual([]);
  });
});
