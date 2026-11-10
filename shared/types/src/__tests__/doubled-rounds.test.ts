import { describe, expect, it } from 'vitest';
import {
  canBeDoubled,
  doubledRoundIds,
  doubledRoundIdsOfTeam,
  playsJokers,
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

  it('lists only the extra jokers for a team with no joker', () => {
    expect(doubledRoundIdsOfTeam({}, [{ teamId: 7, ...extra(2) }], 7)).toEqual([
      2,
    ]);
  });
});

const plain = { questions: [{ type: 'free_text' as const }] };
const withClue = {
  questions: [{ type: 'free_text' as const }, { type: 'clues' as const }],
};

describe('canBeDoubled', () => {
  it('doubles a round without a Clue question, never one with', () => {
    expect(canBeDoubled(plain)).toBe(true);
    expect(canBeDoubled(withClue)).toBe(false);
  });
});

describe('playsJokers', () => {
  const game = (jokersEnabled: boolean, rounds: (typeof plain)[]) => ({
    settings: { jokersEnabled },
    rounds,
  });

  it('plays with jokers when Jokers is on and some round can be a joker round', () => {
    expect(playsJokers(game(true, [withClue, plain]))).toBe(true);
  });

  it('plays without jokers when Jokers is off, or every round has a Clue question', () => {
    expect(playsJokers(game(false, [plain]))).toBe(false);
    expect(playsJokers(game(true, [withClue, withClue]))).toBe(false);
  });
});
