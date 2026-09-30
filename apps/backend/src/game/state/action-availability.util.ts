import {
  getBlockStartPosition,
  getNextGameState,
  isBreakPointQuestion,
} from '@campus-pubquiz/types';
import { GRADED_STATUSES } from '@/game/state/block-grading.service';
import { tryStepClosestGuessReveal } from '@/game/state/closest-guess-reveal.util';
import { getGameContext, type SessionState } from '@/game/state/session-state';

export interface ActionAvailability {
  canAdvance: boolean;
  canGoToPreviousQuestion: boolean;
}

/**
 * Whether ADVANCE / PREVIOUS would do something if the admin pressed it now.
 * Worked out by trying the action through the same steps, in the same order,
 * as GameStateService.applyAction — the showdown reveal walk, the
 * closest_guess sub-steps, then the state machine — rather than by
 * restating their rules, so the buttons cannot disagree with the handler.
 */
export function getActionAvailability(
  session: SessionState,
): ActionAvailability {
  return {
    canAdvance: isActionAccepted(session, 'ADVANCE'),
    canGoToPreviousQuestion: isActionAccepted(session, 'PREVIOUS'),
  };
}

function isActionAccepted(
  session: SessionState,
  action: 'ADVANCE' | 'PREVIOUS',
): boolean {
  const { progress } = session;

  // Once the quiz has ended an active showdown owns both buttons: ADVANCE
  // always answers (it steps, no-ops on the last step, or tells the admin
  // which guesses are still missing); PREVIOUS only has somewhere to go
  // after the first step.
  if (progress.status === 'ended' && session.activeShowdownRound !== null) {
    return action === 'ADVANCE' || session.showdownRevealStep > 0;
  }

  if (
    progress.status === 'reveal' &&
    tryStepClosestGuessReveal(session, action) !== null
  ) {
    return true;
  }

  try {
    getNextGameState(progress, action, getGameContext(session));
    return true;
  } catch {
    return false;
  }
}

/** roundIndex of the first round in the block the session is currently in — where the question browser's active block starts. */
export function getActiveBlockStartIndex(session: SessionState): number {
  const context = getGameContext(session);
  const { roundIndex, questionIndex } = session.progress;
  if (context.rounds.length <= roundIndex) return 0;
  return getBlockStartPosition(roundIndex, questionIndex, context).roundIndex;
}

/** Whether the quiz master may set up the showdown tiebreaker: on the final round, nothing left ungraded, in a graded status. */
export function isShowdownEligible(session: SessionState): boolean {
  const { rounds } = getGameContext(session);
  const { roundIndex, status } = session.progress;
  return (
    rounds.length > 0 &&
    roundIndex >= rounds.length - 1 &&
    session.ungradedQuestionIds.length === 0 &&
    GRADED_STATUSES.includes(status)
  );
}

/** Whether a question is open or locking and it is the last one before a break — lets the admin pre-set the break end time. */
export function isLastQuestionBeforeBreak(session: SessionState): boolean {
  const context = getGameContext(session);
  const { status, roundIndex, questionIndex } = session.progress;
  return (
    context.rounds.length > roundIndex &&
    (status === 'question_open' || status === 'locking') &&
    isBreakPointQuestion(roundIndex, questionIndex, context)
  );
}
