import { describe, expect, it } from 'vitest';
import {
  drawPin,
  lockPin,
  pinFor,
  powerUpApplies,
  purchaseEffectSchema,
  type PurchaseView,
} from '../index';

describe('drawPin', () => {
  it('picks the answer-key item the random source points at, with its place', () => {
    expect(drawPin('Red | Green | Blue', () => 0.5)).toEqual({
      kind: 'pin_one',
      item: 'Green',
      position: 1,
    });
  });

  it('never runs past the last item', () => {
    expect(drawPin('A|B', () => 0.999999).position).toBe(1);
  });
});

describe('lockPin', () => {
  const pin = { kind: 'pin_one', item: 'C', position: 0 } as const;

  it('puts the pinned item in its place and keeps the others in order', () => {
    expect(lockPin(['A', 'B', 'C', 'D'], pin)).toEqual(['C', 'A', 'B', 'D']);
  });

  it('leaves an order without a pin, or without the item, alone', () => {
    expect(lockPin(['A', 'B'], undefined)).toEqual(['A', 'B']);
    expect(lockPin(['A', 'B'], pin)).toEqual(['A', 'B']);
  });
});

describe('pinFor', () => {
  it('finds the pin the team bought for the question', () => {
    const effect = { kind: 'pin_one', item: 'B', position: 1 } as const;
    const purchases: PurchaseView[] = [
      { powerUp: 'pin_one', questionId: 7, roundId: null, effect },
    ];
    expect(pinFor(7, purchases)).toEqual(effect);
    expect(pinFor(8, purchases)).toBeUndefined();
  });
});

describe('pin one registration', () => {
  it('works on sort and match questions only', () => {
    expect(powerUpApplies('pin_one', { type: 'sort' })).toBe(true);
    expect(powerUpApplies('pin_one', { type: 'match' })).toBe(true);
    expect(powerUpApplies('pin_one', { type: 'multiple_choice' })).toBe(false);
  });

  it('is a valid stored effect', () => {
    expect(
      purchaseEffectSchema.safeParse({
        kind: 'pin_one',
        item: 'B',
        position: 1,
      }).success,
    ).toBe(true);
  });
});
