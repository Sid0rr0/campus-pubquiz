import { describe, expect, it } from 'vitest';
import {
  defaultPowerUpSettings,
  extraJokerOfferEntry,
  extraJokerPurchaseRefusal,
  questionPowerUpOffer,
  questionPurchaseRefusal,
  type PowerUpId,
  type PowerUpSettings,
} from '../index';

const mc = {
  id: 7,
  type: 'multiple_choice' as const,
  options: ['a', 'b', 'c', 'd'],
};
const settings: PowerUpSettings = defaultPowerUpSettings(true);
const base = {
  settings,
  purchases: [] as { powerUp: PowerUpId; questionId: number | null }[],
  balance: 10,
  question: mc as typeof mc | null,
  isRoomReady: true,
};
const entryOf = (input: typeof base, powerUp: PowerUpId) =>
  questionPowerUpOffer(input).find((entry) => entry.powerUp === powerUp);
const refusal = (
  input: typeof base,
  powerUp: PowerUpId,
  questionId: number = mc.id,
) => questionPurchaseRefusal({ ...input, powerUp, questionId });

describe('questionPurchaseRefusal', () => {
  it('allows a buy nothing speaks against', () => {
    expect(refusal(base, 'fifty_fifty')).toBeNull();
  });

  it.each([
    ['no question can be answered', { question: null }],
    ['a question other than the offered one is requested', {}, 8],
  ])('says the answers are locked when %s', (_name, patch, id) => {
    expect(refusal({ ...base, ...patch }, 'fifty_fifty', id)).toBe(
      'Answers are locked for this question',
    );
  });

  it('refuses a power-up that does not work on the question', () => {
    expect(refusal(base, 'first_letter')).toBe(
      'That power-up does not work on this question',
    );
    expect(
      refusal(
        { ...base, question: { ...mc, options: ['a', 'b'] } },
        'fifty_fifty',
      ),
    ).toBe('That power-up does not work on this question');
  });

  it('refuses a power-up the session does not offer', () => {
    const none = {
      ...settings,
      fifty_fifty: { cost: 1, maxUses: 0 },
    };
    expect(refusal({ ...base, settings: none }, 'fifty_fifty')).toBe(
      'That power-up is not offered',
    );
  });

  it('refuses once the limit is used, counting only that power-up', () => {
    const other = [{ powerUp: 'ask_the_room' as const, questionId: 3 }];
    expect(refusal({ ...base, purchases: other }, 'fifty_fifty')).toBeNull();
    const used = [{ powerUp: 'fifty_fifty' as const, questionId: 3 }];
    expect(refusal({ ...base, purchases: used }, 'fifty_fifty')).toBe(
      'You have reached the limit for that power-up',
    );
    const two = { ...settings, fifty_fifty: { cost: 2, maxUses: 2 } };
    expect(
      refusal({ ...base, settings: two, purchases: used }, 'fifty_fifty'),
    ).toBeNull();
  });

  it('refuses a second use on the same question', () => {
    const two = { ...settings, fifty_fifty: { cost: 2, maxUses: 2 } };
    const used = [{ powerUp: 'fifty_fifty' as const, questionId: 7 }];
    expect(
      refusal({ ...base, settings: two, purchases: used }, 'fifty_fifty'),
    ).toBe('You already used that power-up on this question');
  });

  it('does not count another power-up used on the same question', () => {
    const other = [{ powerUp: 'ask_the_room' as const, questionId: 7 }];
    expect(refusal({ ...base, purchases: other }, 'fifty_fifty')).toBeNull();
  });

  it('refuses when the balance is below the cost, allows when equal', () => {
    expect(refusal({ ...base, balance: 1 }, 'fifty_fifty')).toBe(
      'Not enough coins',
    );
    expect(refusal({ ...base, balance: 2 }, 'fifty_fifty')).toBeNull();
  });

  it('waits for Ask the room last, after coins', () => {
    const waiting = { ...base, isRoomReady: false };
    expect(refusal(waiting, 'ask_the_room')).toBe('Waiting for more answers');
    expect(refusal({ ...waiting, balance: 0 }, 'ask_the_room')).toBe(
      'Not enough coins',
    );
    expect(refusal(waiting, 'fifty_fifty')).toBeNull();
  });
});

describe('questionPowerUpOffer', () => {
  it('offers every offered question power-up in order, never the extra joker', () => {
    expect(questionPowerUpOffer(base).map((e) => e.powerUp)).toEqual([
      'fifty_fifty',
      'first_letter',
      'letter_count',
      'pin_one',
      'wider_margin',
      'ask_the_room',
    ]);
  });

  it('lists nothing for a session that offers nothing', () => {
    const off = Object.fromEntries(
      Object.entries(settings).map(([id, s]) => [id, { ...s, maxUses: 0 }]),
    ) as PowerUpSettings;
    expect(questionPowerUpOffer({ ...base, settings: off })).toEqual([]);
  });

  it('carries cost, limit and uses of that power-up only', () => {
    const purchases = [
      { powerUp: 'fifty_fifty' as const, questionId: 3 },
      { powerUp: 'ask_the_room' as const, questionId: 3 },
    ];
    expect(entryOf({ ...base, purchases }, 'fifty_fifty')).toMatchObject({
      cost: 2,
      maxUses: 1,
      used: 1,
    });
  });

  it('marks a buyable power-up available', () => {
    expect(entryOf(base, 'fifty_fifty')?.outcome).toEqual({
      status: 'available',
    });
  });

  it('holds back for coins or the room, with the reason', () => {
    expect(entryOf({ ...base, balance: 0 }, 'fifty_fifty')?.outcome).toEqual({
      status: 'held_back',
      reason: 'Not enough coins',
    });
    expect(
      entryOf({ ...base, isRoomReady: false }, 'ask_the_room')?.outcome,
    ).toEqual({ status: 'held_back', reason: 'Waiting for more answers' });
  });

  it('shows short of coins and waiting as not enough coins', () => {
    expect(
      entryOf({ ...base, balance: 0, isRoomReady: false }, 'ask_the_room')
        ?.outcome,
    ).toEqual({ status: 'held_back', reason: 'Not enough coins' });
  });

  it('marks a power-up not available now, with the reason, even when short of coins', () => {
    const used = [{ powerUp: 'fifty_fifty' as const, questionId: 7 }];
    const two = { ...settings, fifty_fifty: { cost: 2, maxUses: 2 } };
    expect(
      entryOf(
        { ...base, settings: two, purchases: used, balance: 0 },
        'fifty_fifty',
      )?.outcome,
    ).toEqual({
      status: 'unavailable',
      reason: 'You already used that power-up on this question',
    });
    expect(
      entryOf({ ...base, question: null }, 'fifty_fifty')?.outcome,
    ).toEqual({
      status: 'unavailable',
      reason: 'Answers are locked for this question',
    });
  });
});

const jokerBase = {
  settings: { ...settings, extra_joker: { cost: 2, maxUses: 2 } },
  purchases: [] as { powerUp: PowerUpId; roundId: number | null }[],
  balance: 2,
  jokerRoundId: 3 as number | null | undefined,
};
const offered = { roundId: 5, roundNumber: 2, title: 'Music' };
const extra = (roundId: number) => ({
  powerUp: 'extra_joker' as const,
  roundId,
});
const jokerRefusal = (
  patch: Partial<typeof jokerBase> = {},
  roundId = 5,
  offeredRoundId: number | null = 5,
) =>
  extraJokerPurchaseRefusal({
    ...jokerBase,
    ...patch,
    roundId,
    offeredRoundId,
  });
const WRONG = 'Only the next round can be doubled, before its intro';
const DOUBLED = 'That round is already doubled';
const LIMIT = 'You have reached the limit for that power-up';
const notOffered = {
  settings: { ...settings, extra_joker: { cost: 2, maxUses: 0 } },
};

describe('extraJokerPurchaseRefusal', () => {
  it('lets a buy through below the limit and with the exact coins', () => {
    expect(jokerRefusal({ purchases: [extra(4)] })).toBeNull();
  });

  it.each([
    ['not offered', notOffered, 9, null, 'That power-up is not offered'],
    ['another round than offered', {}, 6, 5, WRONG],
    ['no round offered', {}, 5, null, WRONG],
    ['the team joker round', { jokerRoundId: 5 }, 5, 5, DOUBLED],
    ['an earlier extra joker on it', { purchases: [extra(5)] }, 5, 5, DOUBLED],
    ['the limit', { purchases: [extra(1), extra(2)] }, 5, 5, LIMIT],
    ['coins', { balance: 1 }, 5, 5, 'Not enough coins'],
  ])('refuses %s', (_name, patch, roundId, offeredRoundId, reason) => {
    expect(jokerRefusal(patch, roundId, offeredRoundId)).toBe(reason);
  });

  it('checks in the server order: round, doubled, limit, coins', () => {
    const all = {
      jokerRoundId: 5,
      balance: 0,
      purchases: [extra(1), extra(2)],
    };
    expect(jokerRefusal(all, 6)).toBe(WRONG);
    expect(jokerRefusal(all)).toBe(DOUBLED);
    expect(jokerRefusal({ ...all, jokerRoundId: 3 })).toBe(LIMIT);
    expect(jokerRefusal({ ...all, jokerRoundId: 3, purchases: [] })).toBe(
      'Not enough coins',
    );
  });

  it('counts only extra jokers toward the limit and doubled rounds', () => {
    expect(
      jokerRefusal({
        purchases: [
          { powerUp: 'fifty_fifty', roundId: 5 },
          { powerUp: 'fifty_fifty', roundId: 6 },
        ],
      }),
    ).toBeNull();
  });
});

describe('extraJokerOfferEntry', () => {
  const entry = (patch: Partial<typeof jokerBase> = {}, offer = offered) =>
    extraJokerOfferEntry({ ...jokerBase, ...patch, offer });

  it('is not there when the session does not offer it', () => {
    expect(entry(notOffered)).toBeNull();
  });

  it('is available for the offered round, named by its title', () => {
    expect(entry()).toEqual({
      powerUp: 'extra_joker',
      cost: 2,
      maxUses: 2,
      used: 0,
      outcome: { status: 'available' },
      roundName: 'Music',
    });
  });

  it('names the round "Round N" when its title is hidden', () => {
    expect(entry({}, { ...offered, title: '' })?.roundName).toBe('Round 2');
  });

  it('is held back by coins', () => {
    expect(entry({ balance: 1 })?.outcome).toEqual({
      status: 'held_back',
      reason: 'Not enough coins',
    });
  });

  it.each([
    ['the joker round', { jokerRoundId: 5 }, DOUBLED],
    ['an earlier extra joker', { purchases: [extra(5)] }, DOUBLED],
    ['the limit', { purchases: [extra(1), extra(2)] }, LIMIT],
  ])('is not available now with %s', (_name, patch, reason) => {
    expect(entry(patch)?.outcome).toEqual({ status: 'unavailable', reason });
  });

  it('is not available now with no round offered, and counts its uses', () => {
    const none = extraJokerOfferEntry({
      ...jokerBase,
      purchases: [extra(1)],
      offer: null,
    });
    expect(none?.outcome).toEqual({ status: 'unavailable', reason: WRONG });
    expect(none?.roundName).toBeNull();
    expect(none?.used).toBe(1);
  });
});
