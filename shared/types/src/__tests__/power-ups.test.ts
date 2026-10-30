import { describe, expect, it } from 'vitest';
import {
  coinBalance,
  defaultPowerUpSettings,
  DEFAULT_SESSION_SETTINGS,
  drawRemovedOptions,
  fiftyFiftyLeaveCount,
  optionsAfterPurchases,
  powerUpApplies,
  purchaseEffectSchema,
  purchaseRefusal,
  type PurchaseView,
} from '../index';

const ledger = {
  powerUpsEnabled: true,
  startingCoins: 1,
  carriedCoin: 0,
  coinAwards: 0,
  purchaseCosts: 0,
};

describe('defaultPowerUpSettings', () => {
  it('costs 1 each, ask the room 2, extra joker 3 with the overview and 2 without', () => {
    const withOverview = defaultPowerUpSettings(true);
    expect(withOverview.fifty_fifty).toEqual({ cost: 1, maxUses: 1 });
    expect(withOverview.ask_the_room.cost).toBe(2);
    expect(withOverview.extra_joker.cost).toBe(3);
    expect(defaultPowerUpSettings(false).extra_joker.cost).toBe(2);
  });

  it('is what a session starts with, power-ups off and 1 starting coin', () => {
    expect(DEFAULT_SESSION_SETTINGS.powerUpsEnabled).toBe(false);
    expect(DEFAULT_SESSION_SETTINGS.startingCoins).toBe(1);
    expect(DEFAULT_SESSION_SETTINGS.powerUps).toEqual(
      defaultPowerUpSettings(false),
    );
  });
});

describe('fiftyFiftyLeaveCount', () => {
  it.each([
    [3, 2],
    [4, 2],
    [5, 2],
    [6, 3],
    [7, 3],
    [8, 4],
    [9, 4],
  ])('a question with %i options is left with %i', (n, left) => {
    expect(fiftyFiftyLeaveCount(n)).toBe(left);
  });

  it('never leaves fewer than two', () => {
    expect(fiftyFiftyLeaveCount(3)).toBe(2);
  });
});

describe('drawRemovedOptions', () => {
  const options = ['A', 'B', 'C', 'D', 'E', 'F'];

  it('removes n - leave-count options and never the correct one', () => {
    for (const correct of options) {
      for (const value of [0, 0.3, 0.99]) {
        const removed = drawRemovedOptions(options, correct, () => value);
        expect(removed).toHaveLength(3);
        expect(removed).not.toContain(correct);
      }
    }
  });

  it('draws with the random source, returning removed options in option order', () => {
    expect(drawRemovedOptions(options, 'A', () => 0)).toEqual(['B', 'C', 'D']);
    expect(drawRemovedOptions(options, 'A', () => 0.999)).toEqual([
      'D',
      'E',
      'F',
    ]);
  });

  it('leaves the correct option and one other from three', () => {
    expect(drawRemovedOptions(['x', 'y', 'z'], 'y', () => 0)).toEqual(['x']);
  });
});

describe('powerUpApplies', () => {
  it('offers 50/50 on multiple choice with more than two options', () => {
    expect(
      powerUpApplies('fifty_fifty', {
        type: 'multiple_choice',
        options: ['a', 'b', 'c'],
      }),
    ).toBe(true);
  });

  it('does not offer 50/50 with two options', () => {
    expect(
      powerUpApplies('fifty_fifty', {
        type: 'multiple_choice',
        options: ['a', 'b'],
      }),
    ).toBe(false);
  });

  it('does not offer 50/50 on a type that has no options to remove', () => {
    expect(powerUpApplies('fifty_fifty', { type: 'free_text' })).toBe(false);
  });
});

describe('purchaseRefusal', () => {
  const ok = {
    setting: { cost: 1, maxUses: 1 },
    usesInSession: 0,
    isUsedOnQuestion: false,
    balance: 1,
    isAnswerable: true,
    applies: true,
  };

  it('allows a purchase nothing speaks against', () => {
    expect(purchaseRefusal(ok)).toBeNull();
  });

  it('refuses a question that can no longer be answered', () => {
    expect(purchaseRefusal({ ...ok, isAnswerable: false })).toMatch(/locked/i);
  });

  it('refuses a power-up that does not apply to the question', () => {
    expect(purchaseRefusal({ ...ok, applies: false })).toMatch(/question/i);
  });

  it('refuses a power-up the session does not offer', () => {
    expect(
      purchaseRefusal({ ...ok, setting: { cost: 1, maxUses: 0 } }),
    ).toMatch(/not offered/i);
  });

  it('refuses once the session limit is used up', () => {
    expect(purchaseRefusal({ ...ok, usesInSession: 1 })).toMatch(/limit/i);
    expect(
      purchaseRefusal({
        ...ok,
        setting: { cost: 1, maxUses: 2 },
        usesInSession: 1,
      }),
    ).toBeNull();
  });

  it('refuses a power-up already used on this question', () => {
    expect(purchaseRefusal({ ...ok, isUsedOnQuestion: true })).toMatch(
      /already/i,
    );
  });

  it('refuses when the balance is below the cost, allows when equal', () => {
    expect(purchaseRefusal({ ...ok, balance: 0 })).toMatch(/coin/i);
    expect(
      purchaseRefusal({
        ...ok,
        setting: { cost: 2, maxUses: 1 },
        balance: 2,
      }),
    ).toBeNull();
  });
});

describe('optionsAfterPurchases', () => {
  const purchases: PurchaseView[] = [
    {
      powerUp: 'fifty_fifty',
      questionId: 7,
      roundId: null,
      effect: { kind: 'fifty_fifty', removedOptions: ['b', 'c'] },
    },
  ];

  it('hides the options a 50/50 on that question removed', () => {
    expect(optionsAfterPurchases(7, ['a', 'b', 'c', 'd'], purchases)).toEqual([
      'a',
      'd',
    ]);
  });

  it('leaves other questions alone', () => {
    expect(optionsAfterPurchases(8, ['a', 'b', 'c', 'd'], purchases)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });
});

describe('purchaseEffectSchema', () => {
  it('parses a stored 50/50 effect and rejects a malformed one', () => {
    expect(
      purchaseEffectSchema.safeParse({
        kind: 'fifty_fifty',
        removedOptions: ['a'],
      }).success,
    ).toBe(true);
    expect(
      purchaseEffectSchema.safeParse({ kind: 'fifty_fifty' }).success,
    ).toBe(false);
    expect(purchaseEffectSchema.safeParse({ kind: 'nope' }).success).toBe(
      false,
    );
  });
});

describe('coinBalance', () => {
  it('adds starting coins, carried coin and awards, minus purchases', () => {
    expect(
      coinBalance({
        ...ledger,
        startingCoins: 3,
        carriedCoin: 1,
        coinAwards: 2,
        purchaseCosts: 4,
      }),
    ).toBe(2);
  });

  it('ignores starting coins with power-ups off but keeps the carried coin', () => {
    expect(
      coinBalance({ ...ledger, powerUpsEnabled: false, carriedCoin: 1 }),
    ).toBe(1);
  });

  it('never goes below 0', () => {
    expect(coinBalance({ ...ledger, coinAwards: -5 })).toBe(0);
  });
});
