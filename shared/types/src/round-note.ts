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

/** The question a screen puts in front of the room on its own (asked, locking, shown again in break review or revealed); null on every screen that shows none. */
function questionIdOnScreen(screen: OnAirScreen): number | null {
  switch (screen.kind) {
    case 'question':
    case 'locking':
    case 'break_review':
    case 'reveal':
      return screen.questionId;
    default:
      return null;
  }
}

/** The host-only text that belongs to one On-air screen; each field is '' when there is none. */
export interface HostOnlyText {
  roundNote: string;
  questionNotes: string;
}

/**
 * The host-only text of an On-air screen: the round note on the round intro,
 * break round intro and reveal intro (whatever the round's show-on-screen
 * setting), and the notes of the question on the question, locking, break
 * review and reveal screens, looked up by question id across the rounds.
 * Host-only: never a broadcast view.
 */
export function getHostOnlyText(
  rounds: readonly SeededRound[],
  screen: OnAirScreen,
): HostOnlyText {
  const roundNote =
    isRoundNoteScreen(screen) && screen.roundIndex !== null
      ? (rounds[screen.roundIndex]?.note ?? '')
      : '';
  const questionId = questionIdOnScreen(screen);
  const questionNotes =
    questionId === null
      ? ''
      : (rounds
          .map((round) => round.questionNotesById?.[questionId])
          .find((notes) => notes != null) ?? '');
  return { roundNote, questionNotes };
}

/** The round note the big screen draws: the on-air round note when that round shows it on screen, else ''. */
export function getDisplayRoundNote(
  session: SessionState,
  screen: OnAirScreen,
): string {
  const round = roundWithIntroOnAir(session, screen);
  return round?.showNoteOnScreen ? (round.note ?? '') : '';
}
