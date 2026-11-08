import type { SessionSettings } from './session-settings';

/** A quiz's mode, chosen at creation and never changed: see GLOSSARY.md "quiz mode". */
export const QUIZ_MODES = ['pub', 'quickfire'] as const;

export type QuizMode = (typeof QUIZ_MODES)[number];

export type ModeFeature =
  | 'jokers'
  | 'powerUps'
  | 'coins'
  | 'leagues'
  | 'questionTimer';

/** What each mode allows: the one table the refusals, the settings sent and the settings played with derive from. */
const MODE_ALLOWS: Record<QuizMode, Record<ModeFeature, boolean>> = {
  pub: {
    jokers: true,
    powerUps: true,
    coins: true,
    leagues: true,
    questionTimer: false,
  },
  quickfire: {
    jokers: false,
    powerUps: false,
    coins: false,
    leagues: false,
    questionTimer: true,
  },
};

export function quizModeAllows(mode: QuizMode, feature: ModeFeature): boolean {
  return MODE_ALLOWS[mode][feature];
}

export function isQuickfire(mode: QuizMode): boolean {
  return mode === 'quickfire';
}

export const QUICKFIRE_NO_LEAGUE_MESSAGE =
  "A quickfire session can't be added to a league";
export const QUICKFIRE_NO_COIN_AWARD_MESSAGE =
  "A quickfire session has no coins, so it can't award any";

/** The refusal for adding a session of this mode to a league; undefined when allowed. */
export function leagueModeRefusal(mode: QuizMode): string | undefined {
  return quizModeAllows(mode, 'leagues')
    ? undefined
    : QUICKFIRE_NO_LEAGUE_MESSAGE;
}

/** The refusal for awarding coins in this mode (a points-only award is fine); undefined when allowed. */
export function coinAwardModeRefusal(
  mode: QuizMode,
  coins: number | undefined,
): string | undefined {
  return coins && !quizModeAllows(mode, 'coins')
    ? QUICKFIRE_NO_COIN_AWARD_MESSAGE
    : undefined;
}

/**
 * The first refusal for a settings patch (and league ids) aimed at a session
 * of this mode, or undefined. Only what the patch names is checked, so a
 * stored value never blocks an unrelated edit.
 */
export function quizModeSettingsRefusal(
  mode: QuizMode,
  partial: Partial<SessionSettings>,
  leagueIds: readonly number[] | undefined,
): string | undefined {
  if (partial.jokersEnabled === true && !quizModeAllows(mode, 'jokers')) {
    return "A quickfire session can't have jokers";
  }
  if (partial.powerUpsEnabled === true && !quizModeAllows(mode, 'powerUps')) {
    return "A quickfire session can't have power-ups";
  }
  if (partial.startingCoins !== undefined && !quizModeAllows(mode, 'coins')) {
    return "A quickfire session has no coins, so it can't have starting coins";
  }
  if (leagueIds && leagueIds.length > 0) return leagueModeRefusal(mode);
  return undefined;
}

/** The settings a client sends for this mode: a mode without coins drops the coin settings. */
export function settingsToSend(
  mode: QuizMode,
  settings: SessionSettings,
): Partial<SessionSettings> {
  const rest: Partial<SessionSettings> = { ...settings };
  if (!quizModeAllows(mode, 'coins')) {
    delete rest.startingCoins;
    delete rest.powerUps;
  }
  return rest;
}

/** The settings a session of this mode plays with: what the mode disallows is switched off, every field stays present. */
export function settingsForMode(
  mode: QuizMode,
  settings: SessionSettings,
): SessionSettings {
  return {
    ...settings,
    jokersEnabled: settings.jokersEnabled && quizModeAllows(mode, 'jokers'),
    powerUpsEnabled:
      settings.powerUpsEnabled && quizModeAllows(mode, 'powerUps'),
    startingCoins: quizModeAllows(mode, 'coins') ? settings.startingCoins : 0,
  };
}
