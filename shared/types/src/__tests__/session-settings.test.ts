import { describe, expect, it } from 'vitest';
import {
  hasJokersWithoutOverview,
  JOKERS_NEED_OVERVIEW_MESSAGE,
} from '../session-settings';

describe('hasJokersWithoutOverview', () => {
  it('is true only for jokers on with the overview off', () => {
    expect(
      hasJokersWithoutOverview({
        jokersEnabled: true,
        showRoundOverview: false,
      }),
    ).toBe(true);
    expect(
      hasJokersWithoutOverview({
        jokersEnabled: true,
        showRoundOverview: true,
      }),
    ).toBe(false);
    expect(
      hasJokersWithoutOverview({
        jokersEnabled: false,
        showRoundOverview: false,
      }),
    ).toBe(false);
    expect(
      hasJokersWithoutOverview({
        jokersEnabled: false,
        showRoundOverview: true,
      }),
    ).toBe(false);
  });

  it('reads a field left out as neither value', () => {
    expect(hasJokersWithoutOverview({ jokersEnabled: true })).toBe(false);
    expect(hasJokersWithoutOverview({ showRoundOverview: false })).toBe(false);
    expect(hasJokersWithoutOverview({})).toBe(false);
  });

  it('has a message naming the missing overview', () => {
    expect(JOKERS_NEED_OVERVIEW_MESSAGE).toBe('Jokers need the round overview');
  });
});
