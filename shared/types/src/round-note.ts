import type { OnAirScreen } from './on-air-screen';
import type { SeededRound, SessionState } from './session-state';

/** Longest round note, in characters, after trimming — enforced at the quiz-draft save boundary and shown as the editor's character count. */
export const ROUND_NOTE_MAX_LENGTH = 500;

/** Whether the screen is a round's intro or break round intro (the reveal intro is not). */
export function isRoundIntroScreen(
  screen: OnAirScreen,
): screen is Extract<
  OnAirScreen,
  { kind: 'round_title' | 'break_round_title' }
> {
  return screen.kind === 'round_title' || screen.kind === 'break_round_title';
}

/** Whether the screen is a round's intro, break round intro or reveal intro: where the presenter remote shows the round note. */
export function isRoundNoteScreen(
  screen: OnAirScreen,
): screen is Extract<
  OnAirScreen,
  { kind: 'round_title' | 'break_round_title' | 'reveal_intro' }
> {
  return isRoundIntroScreen(screen) || screen.kind === 'reveal_intro';
}

/** The round whose intro or break round intro is on air; undefined on every other screen (the reveal intro included). */
function roundWithIntroOnAir(
  session: SessionState,
  screen: OnAirScreen,
): SeededRound | undefined {
  if (!isRoundIntroScreen(screen)) return undefined;
  if (screen.roundIndex === null) return undefined;
  return session.seededGame.rounds[screen.roundIndex];
}

/**
 * The note of the round whose intro, break round intro or reveal intro is on
 * air; null on every other screen or when that round has none. Host-only: for
 * the presenter context, never a broadcast view (the big screen never shows
 * it on the reveal intro, see getDisplayRoundNote).
 */
export function getRoundNoteOnAir(
  session: SessionState,
  screen: OnAirScreen,
): string | null {
  if (!isRoundNoteScreen(screen) || screen.roundIndex === null) return null;
  return session.seededGame.rounds[screen.roundIndex]?.note ?? null;
}

/** The round note the big screen draws: the on-air round note when that round shows it on screen, else ''. */
export function getDisplayRoundNote(
  session: SessionState,
  screen: OnAirScreen,
): string {
  const round = roundWithIntroOnAir(session, screen);
  return round?.showNoteOnScreen ? (round.note ?? '') : '';
}
