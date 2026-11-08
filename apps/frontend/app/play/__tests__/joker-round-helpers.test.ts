import { describe, expect, it } from 'vitest';
import {
  doubledRoundsOf,
  isJokerRoundPlayed,
  jokerExtraPoints,
  jokerMarksOf,
  selectedResultOf,
} from '@/app/play/joker-round';

describe('jokerExtraPoints', () => {
  it('is the points the joker adds in the joker round', () => {
    expect(jokerExtraPoints(3, 2, [2])).toBe(3);
  });

  it('is null outside the joker round, or with no joker', () => {
    expect(jokerExtraPoints(3, 1, [2])).toBeNull();
    expect(jokerExtraPoints(3, 1, [])).toBeNull();
  });

  it('is null when nothing was earned to double', () => {
    expect(jokerExtraPoints(null, 2, [2])).toBeNull();
    expect(jokerExtraPoints(0, 2, [2])).toBeNull();
  });
});

describe('jokerMarksOf', () => {
  const jokerRounds = [{ roundId: 20, roundNumber: 2, title: 'Music' }];
  const viewOf = (phoneScreen: unknown) =>
    ({
      jokerRounds,
      phoneScreen,
      blockQuestions: [
        { id: 1, roundNumber: 1 },
        { id: 2, roundNumber: 2 },
      ],
    }) as never;
  const joker = { roundId: 20 };

  it('marks the title card of a doubled round only', () => {
    const marks = (roundNumber: number) =>
      jokerMarksOf(
        viewOf({ kind: 'round_title', roundNumber }),
        joker,
        [],
        undefined,
      );
    expect(marks(2).isJokerTitleCard).toBe(true);
    expect(marks(1).isJokerTitleCard).toBe(false);
    expect(
      jokerMarksOf(viewOf({ kind: 'lobby' }), joker, [], undefined)
        .isJokerTitleCard,
    ).toBe(false);
  });

  it('marks the selected question in a doubled round, not out of one or with none', () => {
    const marks = (id?: number) =>
      jokerMarksOf(viewOf({ kind: 'lobby' }), joker, [], id).isJokerQuestion;
    expect(marks(2)).toBe(true);
    expect(marks(1)).toBe(false);
    expect(marks(undefined)).toBe(false);
  });

  it('marks nothing without a joker', () => {
    const marks = jokerMarksOf(viewOf({ kind: 'lobby' }), null, [], 2);
    expect(marks.doubledRoundNumbers).toEqual([]);
    expect(marks.isJokerQuestion).toBe(false);
  });
});

describe('selectedResultOf', () => {
  const entry = (
    id: number,
    roundNumber: number,
    pointsAwarded: number | null,
  ) => ({ id, roundNumber, pointsAwarded, verdict: 'correct' }) as never;

  it('is all null with no selection', () => {
    expect(selectedResultOf([entry(1, 2, 3)], undefined, [2])).toEqual({
      points: null,
      verdict: null,
      jokerExtra: null,
    });
  });

  it('is all null for a question not opened', () => {
    expect(selectedResultOf([entry(1, 2, 3)], 9, [2]).points).toBeNull();
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
        [2],
      ),
    ).toEqual({ points: null, verdict: null, jokerExtra: null });
  });

  it('adds the joker extra on a doubled round with points', () => {
    expect(selectedResultOf([entry(1, 2, 3)], 1, [2])).toEqual({
      points: 3,
      verdict: 'correct',
      jokerExtra: 3,
    });
  });

  it('adds no extra on zero points or off a doubled round', () => {
    expect(selectedResultOf([entry(1, 2, 0)], 1, [2]).jokerExtra).toBeNull();
    expect(selectedResultOf([entry(1, 1, 3)], 1, [2]).jokerExtra).toBeNull();
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

describe('doubledRoundsOf', () => {
  it('lists the joker round and the extra-joker rounds in quiz order', () => {
    const round = (roundNumber: number) => ({
      roundNumber,
      title: `R${roundNumber}`,
    });
    const bought = (roundNumber: number) => ({
      powerUp: 'extra_joker',
      roundId: roundNumber * 10,
      round: round(roundNumber),
    });
    const purchases = [
      bought(1),
      bought(4),
      bought(3),
      { powerUp: 'fifty_fifty', roundId: null },
    ] as never;
    expect(
      doubledRoundsOf({ ...round(3), roundId: 30 }, purchases).map(
        (r) => r.roundNumber,
      ),
    ).toEqual([1, 3, 4]);
  });
});
