import { describe, expect, it } from 'vitest';
import {
  QUICKFIRE_NO_COIN_AWARD_MESSAGE,
  QUICKFIRE_NO_LEAGUE_MESSAGE,
  coinAwardModeRefusal,
  isQuickfire,
  leagueModeRefusal,
  quizModeAllows,
  quizModeSettingsRefusal,
  settingsForMode,
  settingsToSend,
} from '../quiz-mode';
import { DEFAULT_SESSION_SETTINGS } from '../session-settings';

describe('what each quiz mode allows', () => {
  it.each([
    [
      'pub',
      {
        jokers: true,
        powerUps: true,
        coins: true,
        leagues: true,
        questionTimer: false,
      },
    ],
    [
      'quickfire',
      {
        jokers: false,
        powerUps: false,
        coins: false,
        leagues: false,
        questionTimer: true,
      },
    ],
  ] as const)('%s', (mode, allows) => {
    for (const [feature, allowed] of Object.entries(allows)) {
      expect(quizModeAllows(mode, feature as keyof typeof allows)).toBe(
        allowed,
      );
    }
    expect(isQuickfire(mode)).toBe(mode === 'quickfire');
  });
});

describe('the settings refusal', () => {
  it.each([
    [{ jokersEnabled: true }, "A quickfire session can't have jokers"],
    [{ versusEnabled: true }, "A quickfire session can't have Versus"],
    [{ powerUpsEnabled: true }, "A quickfire session can't have power-ups"],
    [
      { startingCoins: 0 },
      "A quickfire session has no coins, so it can't have starting coins",
    ],
  ])('refuses %j on quickfire', (patch, message) => {
    expect(quizModeSettingsRefusal('quickfire', patch, undefined)).toBe(
      message,
    );
  });

  it('refuses league ids with the league message', () => {
    expect(quizModeSettingsRefusal('quickfire', {}, [1])).toBe(
      QUICKFIRE_NO_LEAGUE_MESSAGE,
    );
  });

  it('accepts unrelated settings, switching things off and no leagues', () => {
    expect(
      quizModeSettingsRefusal(
        'quickfire',
        {
          showRoundOverview: true,
          collectFeedback: false,
          jokersEnabled: false,
          powerUpsEnabled: false,
        },
        [],
      ),
    ).toBeUndefined();
  });

  it('reports the first refusal in order: jokers, power-ups, coins, leagues', () => {
    const all = {
      jokersEnabled: true,
      powerUpsEnabled: true,
      startingCoins: 3,
    };
    expect(quizModeSettingsRefusal('quickfire', all, [1])).toBe(
      "A quickfire session can't have jokers",
    );
    expect(
      quizModeSettingsRefusal(
        'quickfire',
        { powerUpsEnabled: true, startingCoins: 3 },
        [1],
      ),
    ).toBe("A quickfire session can't have power-ups");
    expect(
      quizModeSettingsRefusal('quickfire', { startingCoins: 3 }, [1]),
    ).toMatch(/starting coins/);
  });

  it('refuses nothing for a pub quiz', () => {
    expect(
      quizModeSettingsRefusal(
        'pub',
        { jokersEnabled: true, powerUpsEnabled: true, startingCoins: 5 },
        [1, 2],
      ),
    ).toBeUndefined();
  });
});

describe('league and coin award refusals', () => {
  it('quickfire refuses leagues and coin awards, not a points-only award', () => {
    expect(leagueModeRefusal('quickfire')).toBe(QUICKFIRE_NO_LEAGUE_MESSAGE);
    expect(coinAwardModeRefusal('quickfire', 2)).toBe(
      QUICKFIRE_NO_COIN_AWARD_MESSAGE,
    );
    expect(coinAwardModeRefusal('quickfire', 0)).toBeUndefined();
    expect(coinAwardModeRefusal('quickfire', undefined)).toBeUndefined();
  });

  it('pub refuses neither', () => {
    expect(leagueModeRefusal('pub')).toBeUndefined();
    expect(coinAwardModeRefusal('pub', 2)).toBeUndefined();
  });
});

describe('the settings to send', () => {
  it('quickfire drops the coin settings', () => {
    const sent = settingsToSend('quickfire', DEFAULT_SESSION_SETTINGS);
    expect(sent).not.toHaveProperty('startingCoins');
    expect(sent).not.toHaveProperty('powerUps');
    expect(sent.lockGraceSeconds).toBe(60);
  });

  it('pub sends everything', () => {
    expect(settingsToSend('pub', DEFAULT_SESSION_SETTINGS)).toEqual(
      DEFAULT_SESSION_SETTINGS,
    );
  });
});

describe('the settings a mode plays with', () => {
  const on = {
    ...DEFAULT_SESSION_SETTINGS,
    jokersEnabled: true,
    versusEnabled: true,
    powerUpsEnabled: true,
    startingCoins: 7,
    collectFeedback: false,
  };

  it('quickfire switches jokers, Versus, power-ups and coins off, leaving the rest', () => {
    expect(settingsForMode('quickfire', on)).toEqual({
      ...on,
      jokersEnabled: false,
      versusEnabled: false,
      powerUpsEnabled: false,
      startingCoins: 0,
    });
  });

  it('pub returns the settings unchanged', () => {
    expect(settingsForMode('pub', on)).toEqual(on);
  });
});
