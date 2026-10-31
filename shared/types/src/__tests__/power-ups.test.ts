import { describe, expect, it } from 'vitest';
import {
  askTheRoomReady,
  askTheRoomSplit,
  defaultPowerUpSettings,
  DEFAULT_SESSION_SETTINGS,
  drawPin,
  drawRemovedOptions,
  extraJokerRefusal,
  extraJokerRoundId,
  fiftyFiftyLeaveCount,
  optionsAfterPurchases,
  POWER_UP_LABELS,
  powerUpApplies,
  purchaseEffectSchema,
  purchaseRefusal,
  teamCoins,
  textHint,
  visibleRoundTitle,
  type PurchaseView,
} from '../index';

describe('defaultPowerUpSettings', () => {
  it('costs letter count 1, ask the room 3, the rest 2, extra joker 4 with the overview and 3 without', () => {
    const withOverview = defaultPowerUpSettings(true);
    expect(withOverview.fifty_fifty).toEqual({ cost: 2, maxUses: 1 });
    expect(withOverview.letter_count.cost).toBe(1);
    expect(withOverview.ask_the_room.cost).toBe(3);
    expect(withOverview.extra_joker.cost).toBe(4);
    expect(defaultPowerUpSettings(false).extra_joker.cost).toBe(3);
  });

  it('is what a session starts with, power-ups off and 2 starting coins', () => {
    expect(DEFAULT_SESSION_SETTINGS.powerUpsEnabled).toBe(false);
    expect(DEFAULT_SESSION_SETTINGS.startingCoins).toBe(2);
    expect(DEFAULT_SESSION_SETTINGS.powerUps).toEqual(
      defaultPowerUpSettings(false),
    );
  });
});

describe('extraJokerRoundId', () => {
  const rounds = [
    { id: 1, questions: [{ id: 10 }] },
    { id: 2, questions: [{ id: 20 }] },
  ];
  const offered = (status: string, roundIndex: number, opened: number[] = []) =>
    extraJokerRoundId({
      seededGame: { rounds },
      openedQuestionIds: opened,
      progress: { status, roundIndex },
    });

  it.each(['rules', 'round_overview', 'joker_pick'])(
    'offers the first round before any intro has been on air, in %s, whatever the round index',
    (status) => {
      expect(offered(status, 0)).toBe(1);
      expect(offered(status, 1)).toBe(1);
    },
  );

  it.each(['round_intro', 'question_open', 'locking', 'break_intro', 'break'])(
    'never offers a round whose intro has passed, in %s, even with no question opened',
    (status) => {
      expect(offered(status, 0)).toBe(2);
    },
  );

  it('offers nothing in the lobby, where the settings can still turn power-ups off', () => {
    expect(offered('lobby', 0)).toBeNull();
  });

  it('offers nothing once the quiz has ended', () => {
    expect(offered('ended', 0)).toBeNull();
    expect(offered('ended', 1)).toBeNull();
  });
});

describe('extraJokerRefusal', () => {
  const ok = {
    setting: { cost: 2, maxUses: 2 },
    usesInSession: 0,
    balance: 2,
    roundId: 5,
    offeredRoundId: 5,
    doubledRoundIds: [3],
  };

  it('lets a purchase through', () => {
    expect(extraJokerRefusal(ok)).toBeNull();
  });

  it('refuses a power-up the session does not offer, before anything else', () => {
    expect(
      extraJokerRefusal({
        ...ok,
        setting: { cost: 2, maxUses: 0 },
        roundId: 9,
      }),
    ).toBe('That power-up is not offered');
  });

  it('refuses any round but the one on offer, including when none is', () => {
    const wrong = 'Only the next round can be doubled, before its intro';
    expect(extraJokerRefusal({ ...ok, roundId: 6 })).toBe(wrong);
    expect(extraJokerRefusal({ ...ok, offeredRoundId: null })).toBe(wrong);
  });

  it('refuses a round the team already doubles', () => {
    expect(extraJokerRefusal({ ...ok, doubledRoundIds: [5] })).toBe(
      'That round is already doubled',
    );
  });

  it('refuses at the per-session limit, but not below it', () => {
    expect(extraJokerRefusal({ ...ok, usesInSession: 2 })).toBe(
      'You have reached the limit for that power-up',
    );
    expect(extraJokerRefusal({ ...ok, usesInSession: 1 })).toBeNull();
  });

  it('refuses when the balance is short of the cost, but not when it equals it', () => {
    expect(extraJokerRefusal({ ...ok, balance: 1 })).toBe('Not enough coins');
    expect(extraJokerRefusal({ ...ok, balance: 2 })).toBeNull();
  });
});

describe('POWER_UP_LABELS', () => {
  // These are the names on the phone's buttons and the /control answer list.
  it('names every power-up as the screens show it', () => {
    expect(POWER_UP_LABELS).toEqual({
      fifty_fifty: '50/50',
      first_letter: 'First letter',
      letter_count: 'Letter count',
      pin_one: 'Pin one',
      wider_margin: 'Wider margin',
      ask_the_room: 'Ask the room',
      extra_joker: 'Extra joker',
    });
  });
});

describe('drawPin', () => {
  it('stays on the last item when the random source reaches 1', () => {
    expect(drawPin('a|b|c', () => 1)).toEqual({
      kind: 'pin_one',
      item: 'c',
      position: 2,
    });
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

describe('drawRemovedOptions at the top of the random range', () => {
  it('stays inside the pool when the random source reaches 1', () => {
    expect(drawRemovedOptions(['A', 'B', 'C', 'D'], 'A', () => 1)).toEqual([
      'C',
      'D',
    ]);
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

describe('askTheRoomSplit', () => {
  const options = ['Paris', 'London', 'Berlin', 'Rome'];

  it('is null until three other teams have answered', () => {
    expect(askTheRoomSplit(options, ['Paris', 'Rome'])).toBeNull();
  });

  it('gives each option its whole-percent share, options nobody picked at 0', () => {
    expect(
      askTheRoomSplit(options, ['Paris', 'Paris', 'Rome', 'London']),
    ).toEqual({ Paris: 50, London: 25, Berlin: 0, Rome: 25 });
  });

  it('shares sum to 100 when thirds do not divide evenly', () => {
    const split = askTheRoomSplit(options, ['Paris', 'London', 'Rome']);
    expect(Object.values(split ?? {}).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('hands the leftover percent to the largest remainder, whatever its place', () => {
    // 1/7, 2/7, 4/7 floor to 14, 28, 57; the lost point goes to the biggest remainder (the middle option).
    expect(
      askTheRoomSplit(['A', 'B', 'C'], ['A', 'B', 'B', 'C', 'C', 'C', 'C']),
    ).toEqual({ A: 14, B: 29, C: 57 });
  });

  it('breaks equal remainders towards the earlier option', () => {
    expect(askTheRoomSplit(['A', 'B', 'C'], ['A', 'B', 'C'])).toEqual({
      A: 34,
      B: 33,
      C: 33,
    });
  });

  it('does not count an answer that is no option towards the threshold', () => {
    expect(
      askTheRoomSplit(options, ['Paris', 'Paris', 'stale', 'other']),
    ).toBeNull();
    expect(
      askTheRoomSplit(options, ['Paris', 'Paris', 'Paris', 'stale']),
    ).toEqual({ Paris: 100, London: 0, Berlin: 0, Rome: 0 });
  });
});

describe('askTheRoomReady', () => {
  const question = {
    type: 'multiple_choice' as const,
    options: ['Paris', 'London', 'Rome'],
  };
  const answer = (teamId: number, value: string) => ({ teamId, value });

  it('needs three other teams with an option-matching answer', () => {
    const others = [answer(2, 'Paris'), answer(3, 'Rome'), answer(4, 'stale')];
    expect(askTheRoomReady(question, others, 1)).toBe(false);
    expect(askTheRoomReady(question, [...others, answer(5, 'London')], 1)).toBe(
      true,
    );
  });

  it('does not count the team’s own answer', () => {
    const answers = [answer(1, 'Paris'), answer(2, 'Paris'), answer(3, 'Rome')];
    expect(askTheRoomReady(question, answers, 1)).toBe(false);
    expect(askTheRoomReady(question, answers, 4)).toBe(true);
  });

  it('is not ready on a multiple-choice question that carries no options', () => {
    const answers = [answer(2, 'x'), answer(3, 'x'), answer(4, 'x')];
    expect(askTheRoomReady({ type: 'multiple_choice' }, answers, 1)).toBe(
      false,
    );
  });

  it('is never ready on a question the power-up does not work on', () => {
    const answers = [answer(2, 'a'), answer(3, 'a'), answer(4, 'a')];
    expect(askTheRoomReady({ type: 'free_text' }, answers, 1)).toBe(false);
  });
});

describe('powerUpApplies', () => {
  it('offers ask the room on multiple choice only', () => {
    const two = { type: 'multiple_choice' as const, options: ['a', 'b'] };
    expect(powerUpApplies('ask_the_room', two)).toBe(true);
    expect(powerUpApplies('ask_the_room', { type: 'free_text' })).toBe(false);
  });

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

describe('textHint of an empty key', () => {
  it('gives an empty hint, not a placeholder', () => {
    expect(textHint('first_letter', '   ')).toBe('');
    expect(textHint('letter_count', '')).toBe('');
  });
});

describe('textHint', () => {
  it('first letter is the key literal first character, case kept', () => {
    expect(textHint('first_letter', 'Eiffel Tower')).toBe('E');
    expect(textHint('first_letter', '  été')).toBe('é');
  });

  it('letter count blanks each letter and digit, keeping spaces and punctuation', () => {
    expect(textHint('letter_count', "Saint-Denis d'Or 2")).toBe(
      "_____-_____ _'__ _",
    );
  });

  it('both hints apply to free text only', () => {
    expect(powerUpApplies('first_letter', { type: 'free_text' })).toBe(true);
    expect(powerUpApplies('letter_count', { type: 'free_text' })).toBe(true);
    expect(powerUpApplies('first_letter', { type: 'number' })).toBe(false);
  });

  it('a stored hint survives the effect schema', () => {
    const effect = { kind: 'letter_count', hint: '___' };
    expect(purchaseEffectSchema.parse(effect)).toEqual(effect);
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

describe('teamCoins', () => {
  const on = { powerUpsEnabled: true, startingCoins: 3 };

  it('adds starting coins, carried coin and awards, minus purchases', () => {
    expect(teamCoins(on, 1, 2, 4)).toBe(2);
  });

  it('ignores starting coins with power-ups off but keeps the carried coin', () => {
    expect(teamCoins({ ...on, powerUpsEnabled: false }, 1)).toBe(1);
  });

  it('never goes below 0', () => {
    expect(teamCoins(on, 0, -5)).toBe(0);
  });
});

describe('visibleRoundTitle', () => {
  const on = { showRoundOverview: true };

  it.each(['lobby', 'rules'] as const)(
    'keeps the title back while the overview has not aired (%s)',
    (status) => {
      expect(visibleRoundTitle(on, status, 'Music')).toBe('');
    },
  );

  it.each([
    'round_overview',
    'joker_pick',
    'round_intro',
    'question_open',
  ] as const)('gives the title once the overview has aired (%s)', (status) => {
    expect(visibleRoundTitle(on, status, 'Music')).toBe('Music');
  });

  it('never gives the title with the overview off', () => {
    expect(
      visibleRoundTitle({ showRoundOverview: false }, 'question_open', 'Music'),
    ).toBe('');
  });
});
