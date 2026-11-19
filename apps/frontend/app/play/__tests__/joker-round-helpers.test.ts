import { describe, expect, it } from 'vitest';
import {
  isJokerRoundPlayed,
  jokerMarksOf,
  selectedResultOf,
} from '@/app/play/joker-round';

describe('jokerMarksOf', () => {
  const doubled = [{ roundId: 20, roundNumber: 2, title: 'Music' }];
  const viewOf = (phoneScreen: unknown) =>
    ({
      phoneScreen,
      blockQuestions: [
        { id: 1, roundNumber: 1 },
        { id: 2, roundNumber: 2 },
      ],
    }) as never;

  it('marks the title card of a doubled round only', () => {
    const marks = (roundNumber: number) =>
      jokerMarksOf(
        viewOf({ kind: 'round_title', roundNumber }),
        doubled,
        undefined,
      );
    expect(marks(2).isJokerTitleCard).toBe(true);
    expect(marks(1).isJokerTitleCard).toBe(false);
    expect(
      jokerMarksOf(viewOf({ kind: 'lobby' }), doubled, undefined)
        .isJokerTitleCard,
    ).toBe(false);
  });

  it('marks the selected question in a doubled round, not out of one or with none', () => {
    const marks = (id?: number) =>
      jokerMarksOf(viewOf({ kind: 'lobby' }), doubled, id).isJokerQuestion;
    expect(marks(2)).toBe(true);
    expect(marks(1)).toBe(false);
    expect(marks(undefined)).toBe(false);
  });

  it('marks nothing with no doubled round', () => {
    const marks = jokerMarksOf(viewOf({ kind: 'lobby' }), [], 2);
    expect(marks.doubledRoundNumbers).toEqual([]);
    expect(marks.isJokerQuestion).toBe(false);
  });
});

describe('selectedResultOf', () => {
  const entry = (id: number, pointsAwarded: number | null) =>
    ({ id, roundNumber: 2, pointsAwarded, verdict: 'correct' }) as never;

  it('is all null with no selection', () => {
    expect(selectedResultOf([entry(1, 3)], undefined, { 1: 3 })).toEqual({
      points: null,
      verdict: null,
      jokerExtra: null,
    });
  });

  it('is all null for a question not opened', () => {
    expect(selectedResultOf([entry(1, 3)], 9, { 1: 3 }).points).toBeNull();
  });

  it('has no verdict or extra for an ungraded selection', () => {
    expect(
      selectedResultOf(
        [
          {
            id: 1,
            roundNumber: 2,
            pointsAwarded: null,
            verdict: null,
          } as never,
        ],
        1,
        {},
      ),
    ).toEqual({ points: null, verdict: null, jokerExtra: null });
  });

  it('shows the joker extra the server gave for the question', () => {
    expect(selectedResultOf([entry(1, 3)], 1, { 1: 3 })).toEqual({
      points: 3,
      verdict: 'correct',
      jokerExtra: 3,
    });
  });

  it('shows no extra for a question the server gave none for', () => {
    expect(selectedResultOf([entry(1, 3)], 1, { 2: 3 }).jokerExtra).toBeNull();
  });
});

describe('isJokerRoundPlayed', () => {
  it('is true once a past revealed question belongs to the joker round', () => {
    expect(
      isJokerRoundPlayed(3, 'reveal', [{ roundNumber: 1 }, { roundNumber: 3 }]),
    ).toBe(true);
  });

  it('is false while only other rounds have been revealed', () => {
    expect(isJokerRoundPlayed(3, 'reveal', [{ roundNumber: 1 }])).toBe(false);
    expect(isJokerRoundPlayed(3, 'reveal', [])).toBe(false);
  });

  it('is true once the quiz has ended', () => {
    expect(isJokerRoundPlayed(3, 'ended', [])).toBe(true);
  });
});
