import type { OnAirScreen } from './on-air-screen';
import type { SeededRound, SessionState } from './session-state';

/** Longest round note, in characters, after trimming — enforced at the quiz-draft save boundary and shown as the editor's character count. */
export const ROUND_NOTE_MAX_LENGTH = 500;

/** The round whose intro or break round intro is on air; undefined on every other screen (the reveal intro included). */
function roundWithIntroOnAir(
  session: SessionState,
  screen: OnAirScreen,
): SeededRound | undefined {
  if (screen.kind !== 'round_title' && screen.kind !== 'break_round_title') {
    return undefined;
  }
  if (screen.roundIndex === null) return undefined;
  return session.seededGame.rounds[screen.roundIndex];
}

/**
 * The note of the round whose intro or break round intro is on air; null on
 * every other screen (the reveal intro included) or when that round has none.
 * Host-only: for the presenter context, never a broadcast view.
 */
export function getRoundNoteOnAir(
  session: SessionState,
  screen: OnAirScreen,
): string | null {
  return roundWithIntroOnAir(session, screen)?.note ?? null;
}

/** The round note the big screen draws: the on-air round note when that round shows it on screen, else ''. */
export function getDisplayRoundNote(
  session: SessionState,
  screen: OnAirScreen,
): string {
  const round = roundWithIntroOnAir(session, screen);
  return round?.showNoteOnScreen ? (round.note ?? '') : '';
}
