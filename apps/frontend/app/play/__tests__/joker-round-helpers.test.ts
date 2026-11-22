import { describe, expect, it } from 'vitest';
import { isJokerRoundPlayed, jokerMarksOf } from '@/app/play/joker-round';

describe('jokerMarksOf', () => {
  const doubled = [{ roundId: 20, roundNumber: 2, title: 'Music' }];
  const viewOf = (phoneScreen: unknown) => ({ phoneScreen }) as never;

  it('marks the title card of a doubled round only', () => {
    const marks = (roundNumber: number) =>
      jokerMarksOf(viewOf({ kind: 'round_title', roundNumber }), doubled);
    expect(marks(2).isJokerTitleCard).toBe(true);
    expect(marks(1).isJokerTitleCard).toBe(false);
    expect(
      jokerMarksOf(viewOf({ kind: 'lobby' }), doubled).isJokerTitleCard,
    ).toBe(false);
  });

  it('marks nothing with no doubled round', () => {
    const marks = jokerMarksOf(
      viewOf({ kind: 'round_title', roundNumber: 2 }),
      [],
    );
    expect(marks.doubledRoundNumbers).toEqual([]);
    expect(marks.isJokerTitleCard).toBe(false);
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
