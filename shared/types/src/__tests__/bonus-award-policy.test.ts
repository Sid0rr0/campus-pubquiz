import { describe, expect, it } from 'vitest';
import {
  decideBonusAward as decide,
  decideBonusEdit,
  type BonusAwardFacts,
  type BonusAwardRequest,
  type BonusAwardSession,
} from '../bonus-award-policy';
import { LOBBY_PROGRESS } from '../session-state';

const OFF_ROSTER: BonusAwardFacts = { existingCount: 0, isOnRoster: false };

/** A bare number is the team's existing award count, on the roster. */
function decideBonusAward(
  session: BonusAwardSession,
  award: BonusAwardRequest,
  facts: number | BonusAwardFacts,
) {
  return decide(
    session,
    award,
    typeof facts === 'number'
      ? { existingCount: facts, isOnRoster: true }
      : facts,
  );
}

function session(
  over: {
    powerUpsEnabled?: boolean;
    quizMode?: 'pub' | 'quickfire';
    enabled?: BonusAwardSession['seededGame']['settings']['enabledBonusCategories'];
    caps?: BonusAwardSession['seededGame']['settings']['maxBonusAwardsPerCategory'];
    awards?: number;
  } = {},
): BonusAwardSession {
  return {
    seededGame: {
      quizMode: over.quizMode ?? 'pub',
      rounds: [{ breakAfter: true, questions: [{ id: 7 }] }],
      settings: {
        powerUpsEnabled: over.powerUpsEnabled ?? false,
        startingCoins: 0,
        enabledBonusCategories: over.enabled ?? ['shot', 'selfie', 'custom'],
        maxBonusAwardsPerCategory: over.caps ?? {},
      },
    },
    progress: LOBBY_PROGRESS,
    carriedCoins: {},
    coinAwards: { 1: over.awards ?? 0 },
    scoringRecords: { powerUps: [] },
  } as BonusAwardSession;
}

const request = (over: Partial<BonusAwardRequest> = {}): BonusAwardRequest => ({
  teamId: 1,
  category: 'shot',
  points: 1,
  ...over,
});

describe('decideBonusAward', () => {
  it('stores a shot award, dropping any reason', () => {
    expect(
      decideBonusAward(session(), request({ reason: 'ignored' }), 0),
    ).toEqual({
      award: {
        bonus: {
          category: 'shot',
          points: 1,
          reason: undefined,
          blockFirstQuestionId: 7,
        },
        linkedCoins: 0,
        manualCoins: 0,
        manualCoinsReason: 'ignored',
      },
    });
  });

  it('trims a custom reason and allows a penalty', () => {
    const decision = decideBonusAward(
      session(),
      request({ category: 'custom', points: -2, reason: '  Late  ' }),
      0,
    );
    expect(decision).toMatchObject({
      award: { bonus: { points: -2, reason: 'Late' } },
    });
  });

  it('earns the shot/selfie coins only with power-ups on and positive points', () => {
    const on = session({ powerUpsEnabled: true });
    expect(decideBonusAward(on, request(), 0)).toMatchObject({
      award: { linkedCoins: 2 },
    });
    expect(decideBonusAward(on, request({ points: -1 }), 0)).toMatchObject({
      award: { linkedCoins: 0 },
    });
    expect(decideBonusAward(session(), request(), 0)).toMatchObject({
      award: { linkedCoins: 0 },
    });
  });

  it('gives coins alone for zero points, skipping category, reason and cap', () => {
    const decision = decideBonusAward(
      session({ powerUpsEnabled: true, enabled: [], caps: { custom: 0 } }),
      request({ category: 'custom', points: 0, coins: 2, reason: ' Quiz ' }),
      5,
    );
    expect(decision).toEqual({
      award: {
        bonus: undefined,
        linkedCoins: 0,
        manualCoins: 2,
        manualCoinsReason: 'Quiz',
      },
    });
  });

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'refuses zero or non-finite points (%p) with no coins',
    (points) => {
      expect(decideBonusAward(session(), request({ points }), 0)).toEqual({
        refusal: 'Bonus points must be a non-zero number',
      });
    },
  );

  it('refuses a coin award in a quickfire quiz', () => {
    expect(
      decideBonusAward(
        session({ quizMode: 'quickfire', powerUpsEnabled: true }),
        request({ coins: 1 }),
        0,
      ),
    ).toHaveProperty('refusal');
  });

  it('refuses a coin award without power-ups', () => {
    expect(decideBonusAward(session(), request({ coins: 1 }), 0)).toEqual({
      refusal: 'Coins can only be awarded in a session with power-ups',
    });
  });

  it('refuses a take larger than the balance', () => {
    expect(
      decideBonusAward(
        session({ powerUpsEnabled: true, awards: 1 }),
        request({ coins: -2 }),
        0,
      ),
    ).toEqual({ refusal: 'That team has only 1 coin to take' });
  });

  it('refuses a category the session turned off', () => {
    expect(
      decideBonusAward(
        session({ enabled: ['shot'] }),
        request({ category: 'selfie' }),
        0,
      ),
    ).toEqual({ refusal: '"selfie" is not enabled for this session' });
  });

  it.each([undefined, '   '])(
    'refuses a custom award with reason %p',
    (reason) => {
      expect(
        decideBonusAward(session(), request({ category: 'custom', reason }), 0),
      ).toEqual({ refusal: 'A custom bonus needs a reason' });
    },
  );

  it('refuses a team that is not on the roster', () => {
    expect(decideBonusAward(session(), request(), OFF_ROSTER)).toEqual({
      refusal: 'Team is not part of this game session',
    });
  });

  it('allows the award that reaches the cap and refuses the next', () => {
    const capped = session({ caps: { shot: 2 } });
    expect(decideBonusAward(capped, request(), 1)).toHaveProperty('award');
    expect(decideBonusAward(capped, request(), 2)).toEqual({
      refusal:
        'This team has already been awarded the "shot" bonus the maximum 2 time(s)',
    });
  });

  it('ignores a cap set for another category', () => {
    expect(
      decideBonusAward(
        session({ caps: { shot: 2 } }),
        request({ category: 'selfie' }),
        5,
      ),
    ).toHaveProperty('award');
  });

  it('reports the first failing rule when several fail together', () => {
    const all = session({ enabled: [], caps: { custom: 0 } });
    const failing = { existingCount: 0, isOnRoster: false };
    // coins without power-ups beat everything
    expect(
      decideBonusAward(all, request({ category: 'custom', coins: 1 }), failing),
    ).toEqual({
      refusal: 'Coins can only be awarded in a session with power-ups',
    });
    // category beats reason, roster and cap
    expect(
      decideBonusAward(all, request({ category: 'custom' }), failing),
    ).toEqual({ refusal: '"custom" is not enabled for this session' });
    // reason beats roster and cap
    const enabled = session({ caps: { custom: 0 } });
    expect(
      decideBonusAward(enabled, request({ category: 'custom' }), failing),
    ).toEqual({ refusal: 'A custom bonus needs a reason' });
    // roster beats cap
    expect(
      decideBonusAward(
        enabled,
        request({ category: 'custom', reason: 'x' }),
        failing,
      ),
    ).toEqual({ refusal: 'Team is not part of this game session' });
  });
});

describe('decideBonusEdit', () => {
  it('keeps the points and drops the reason on a shot award', () => {
    expect(decideBonusEdit({ category: 'shot', points: 1 }, 3, ' x ')).toEqual({
      points: 3,
      reason: undefined,
    });
  });

  it('trims the reason of a custom award and lets it change sign', () => {
    expect(
      decideBonusEdit({ category: 'custom', points: -2 }, 2, '  Heckling '),
    ).toEqual({ points: 2, reason: 'Heckling' });
  });

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses points %p',
    (points) => {
      expect(
        decideBonusEdit({ category: 'shot', points: 1 }, points, undefined),
      ).toEqual({ refusal: 'Bonus points must be a non-zero number' });
    },
  );

  it('refuses a custom award with a blank reason', () => {
    expect(
      decideBonusEdit({ category: 'custom', points: 3 }, 5, '   '),
    ).toEqual({ refusal: 'A custom bonus needs a reason' });
  });

  it.each([
    [1, -1],
    [-1, 1],
  ])('refuses flipping a shot award from %p to %p', (before, after) => {
    expect(
      decideBonusEdit({ category: 'shot', points: before }, after, undefined),
    ).toEqual({
      refusal:
        'A shot or selfie award cannot change between a bonus and a penalty — delete it and give a new one',
    });
  });
});
