import { shownAtStep } from './closest-guess-reveal';
import { describeDisplayScreen, type DisplayScreen } from './display-screen';
import type { GameProgress } from './game-state-types';
import { describeOnAirScreen, type OnAirScreen } from './on-air-screen';
import type {
  BlockRevealQuestionView,
  PlayersRevealQuestionView,
} from './question-views';
import type { SessionState } from './session-state';
import type { StateSnapshotPayload } from './room-views';
import { buildSnapshot } from './session-snapshot';
import { revealStepOf } from './stepped-reveal';

/** The question on air in 'reveal', shown only as far as its closest-guess step has got; earlier reveal questions, and every question outside 'reveal', are sent whole. */
export function trimOnAirQuestion(
  revealQuestions: readonly BlockRevealQuestionView[],
  { status, revealIndex }: GameProgress,
  closestGuessRevealStep: number,
): PlayersRevealQuestionView[] {
  return revealQuestions.map((question, index) =>
    status === 'reveal' && index === revealIndex
      ? shownAtStep(question, closestGuessRevealStep)
      : question,
  );
}

/**
 * The one assembly of the Display screen /display is sent, from the pieces a
 * caller has already built. The Screen projection and the Move plan both go
 * through it, so what the big screen shows and what the admin view reads
 * from it can't drift.
 */
export function assembleDisplayScreen(
  session: SessionState,
  snapshot: StateSnapshotPayload,
  onAir: OnAirScreen,
  closestGuessRevealStep: number,
): DisplayScreen {
  return describeDisplayScreen({
    session,
    onAir,
    snapshot,
    revealQuestions: trimOnAirQuestion(
      snapshot.revealQuestions,
      snapshot.progress,
      closestGuessRevealStep,
    ),
  });
}

/** The Display screen /display is sent for `session` right now. */
export function describeSessionDisplayScreen(
  session: SessionState,
): DisplayScreen {
  const snapshot = buildSnapshot(session);
  const closestGuessRevealStep = revealStepOf(session, 'closest_guess');
  const { screen } = describeOnAirScreen({
    ...snapshot,
    closestGuessRevealStep,
  });
  return assembleDisplayScreen(
    session,
    snapshot,
    screen,
    closestGuessRevealStep,
  );
}
