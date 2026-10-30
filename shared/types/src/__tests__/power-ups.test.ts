import { describe, expect, it } from 'vitest';
import {
  coinBalance,
  defaultPowerUpSettings,
  DEFAULT_SESSION_SETTINGS,
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
