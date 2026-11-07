import type { QuizMode, SessionSettings } from '@campus-pubquiz/types';

/** Whether a session of a quiz in this mode is a quickfire session: the one place that reads the mode. */
export function isQuickfireSession({
  quizMode,
}: {
  quizMode: QuizMode;
}): boolean {
  return quizMode === 'quickfire';
}

export const QUICKFIRE_NO_LEAGUE_MESSAGE =
  "A quickfire session can't be added to a league";

/**
 * The refusal for a settings patch (and league ticks) aimed at a quickfire
 * session, which has no jokers, power-ups, coins or leagues; undefined when
 * the patch is allowed. Only what the patch names is checked, so a stored
 * value of a migrated session never blocks an unrelated edit.
 */
export function quickfireSettingsRefusal(
  partial: Partial<SessionSettings>,
  leagueIds: readonly number[] | undefined,
): string | undefined {
  if (partial.jokersEnabled === true) {
    return "A quickfire session can't have jokers";
  }
  if (partial.powerUpsEnabled === true) {
    return "A quickfire session can't have power-ups";
  }
  if (partial.startingCoins !== undefined) {
    return "A quickfire session has no coins, so it can't have starting coins";
  }
  if (leagueIds && leagueIds.length > 0) return QUICKFIRE_NO_LEAGUE_MESSAGE;
  return undefined;
}
