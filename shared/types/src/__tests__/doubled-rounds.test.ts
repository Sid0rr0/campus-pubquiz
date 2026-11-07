import { describe, expect, it } from 'vitest';
import {
  doubledRoundIds,
  doubledRoundIdsOfTeam,
  type DoublingPurchase,
} from '../doubled-rounds';

const extra = (roundId: number | null): DoublingPurchase => ({
  powerUp: 'extra_joker',
  roundId,
});

describe('doubledRoundIds', () => {
  it.each<[string, number | undefined, DoublingPurchase[], number[]]>([
    ['no joker and no purchases', undefined, [], []],
    ['joker only', 1, [], [1]],
    ['extra joker only', undefined, [extra(2)], [2]],
    ['joker and extra joker on different rounds', 1, [extra(2)], [1, 2]],
    ['joker and extra joker on the same round', 1, [extra(1)], [1]],
    ['several extra jokers', undefined, [extra(2), extra(3)], [2, 3]],
    [
      'question power-ups ignored',
      undefined,
      [{ powerUp: 'fifty_fifty', roundId: 4 }],
      [],
    ],
    ['an extra joker with no round ignored', 1, [extra(null)], [1]],
  ])('%s', (_name, jokerRoundId, purchases, expected) => {
    expect(doubledRoundIds(jokerRoundId, purchases)).toEqual(expected);
  });
});

describe('doubledRoundIdsOfTeam', () => {
  it("reads the team's joker and its own purchases only", () => {
    expect(
      doubledRoundIdsOfTeam(
        {
          7: { roundId: 1, source: 'chosen' },
          8: { roundId: 9, source: 'chosen' },
        },
        [
          { teamId: 7, ...extra(2) },
          { teamId: 8, ...extra(3) },
        ],
        7,
      ),
    ).toEqual([1, 2]);
  });
});
