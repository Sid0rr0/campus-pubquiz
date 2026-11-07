import { describe, expect, it } from 'vitest';
import { coinBalance, coinDebt } from '../coin-ledger';

function session(
  over: {
    powerUpsEnabled?: boolean;
    carried?: number;
    awards?: number;
    purchases?: { teamId: number; cost: number }[];
  } = {},
) {
  return {
    seededGame: {
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

  it('passed-in purchases replace the cached ones for that team only', () => {
    const s = session({ purchases: [{ teamId: 1, cost: 3 }] });
    expect(coinBalance(s, 1, [{ cost: 1 }])).toBe(2);
    expect(coinDebt(s, 1, [{ cost: 5 }])).toBe(2);
    expect(coinBalance(s, 1)).toBe(0);
  });
});
