import { describe, expect, it } from 'vitest';
import {
  bonusCoinsEarned,
  coinAwardRefusal,
  coinBalance,
  coinDebt,
  coinDebtCover,
  coinTakeRefusal,
  coinsShown,
} from '../coin-ledger';

function session(
  over: {
    powerUpsEnabled?: boolean;
    quizMode?: 'pub' | 'quickfire';
    carried?: number;
    awards?: number;
    purchases?: { teamId: number; cost: number }[];
  } = {},
) {
  return {
    seededGame: {
      quizMode: over.quizMode ?? ('pub' as const),
      settings: {
        powerUpsEnabled: over.powerUpsEnabled ?? true,
        startingCoins: 3,
      },
    },
    carriedCoins: { 1: over.carried ?? 0 },
    coinAwards: { 1: over.awards ?? 0 },
    funFactData: { powerUps: over.purchases ?? [] },
  };
}

describe('coin ledger', () => {
  it.each([
    [
      'starting + carried + awards - purchases',
      {
        carried: 1,
        awards: 2,
        purchases: [{ teamId: 1, cost: 4 }],
      },
      2,
      0,
    ],
    ['starting coins only with power-ups on', {}, 3, 0],
    [
      'carried coins count with power-ups off, starting coins do not',
      {
        powerUpsEnabled: false,
        carried: 1,
      },
      1,
      0,
    ],
    [
      'the floor at zero hides the debt',
      {
        awards: -5,
        purchases: [{ teamId: 1, cost: 2 }],
      },
      0,
      4,
    ],
    [
      'other teams purchases do not count',
      {
        purchases: [{ teamId: 2, cost: 2 }],
      },
      3,
      0,
    ],
  ])('%s', (_name, over, balance, debt) => {
    const s = session(over);
    expect(coinBalance(s, 1)).toBe(balance);
    expect(coinDebt(s, 1)).toBe(debt);
  });

  it.each([
    ['quickfire', { quizMode: 'quickfire' as const }, 2, 'quickfire'],
    ['power-ups off', { powerUpsEnabled: false }, 2, 'power-ups'],
    [
      'quickfire wins over power-ups off',
      { quizMode: 'quickfire' as const, powerUpsEnabled: false },
      -1,
      'quickfire',
    ],
    ['allowed', {}, 2, undefined],
    ['no coins given', { quizMode: 'quickfire' as const }, 0, undefined],
    ['no coins field', { powerUpsEnabled: false }, undefined, undefined],
  ])('coin award refusal: %s', (_name, over, coins, expected) => {
    const refusal = coinAwardRefusal(session(over), coins);
    if (expected === undefined) expect(refusal).toBeUndefined();
    else expect(refusal).toContain(expected);
  });

  it.each([
    [-3, undefined],
    [-4, 'That team has only 3 coins to take'],
    [-2, undefined],
    [2, undefined],
    [undefined, undefined],
  ])('take of %s against a balance of 3', (coins, expected) => {
    expect(coinTakeRefusal(session(), 1, coins)).toBe(expected);
  });

  it('a take names "1 coin" in the singular and 0 coins when broke', () => {
    expect(coinTakeRefusal(session({ awards: -2 }), 1, -2)).toBe(
      'That team has only 1 coin to take',
    );
    expect(coinTakeRefusal(session({ powerUpsEnabled: false }), 1, -1)).toBe(
      'That team has only 0 coins to take',
    );
  });

  it.each([
    ['none: awards still cover the spend', 1, 0],
    ['partial: one coin short', 0, 1],
    ['full: the award was the only income', -2, 3],
  ])('debt cover %s', (_name, total, expected) => {
    // 3 starting coins, 4 spent: an award total of 1 is the least that hides no debt.
    const s = session({ purchases: [{ teamId: 1, cost: 4 }], awards: 5 });
    expect(coinDebtCover(s, 1, total)).toBe(expected);
  });

  it.each([
    ['shot', true, 'shot', 1, 2],
    ['selfie', true, 'selfie', 5, 2],
    ['custom', true, 'custom', 1, 0],
    ['penalty', true, 'shot', -1, 0],
    ['zero points', true, 'shot', 0, 0],
    ['power-ups off', false, 'selfie', 1, 0],
  ] as const)(
    'bonus coins earned: %s',
    (_name, on, category, points, coins) => {
      expect(bonusCoinsEarned(on, category, points)).toBe(coins);
    },
  );

  it.each([
    [true, 0, true],
    [true, 3, true],
    [false, 2, true],
    [false, 0, false],
  ])('coins shown: power-ups %s, balance %s', (on, balance, shown) => {
    expect(coinsShown(on, balance)).toBe(shown);
  });

  it('passed-in purchases replace the cached ones for that team only', () => {
    const s = session({ purchases: [{ teamId: 1, cost: 3 }] });
    expect(coinBalance(s, 1, [{ cost: 1 }])).toBe(2);
    expect(coinDebt(s, 1, [{ cost: 5 }])).toBe(2);
    expect(coinBalance(s, 1)).toBe(0);
  });
});
