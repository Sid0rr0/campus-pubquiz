import {
  getBlockStartPosition,
  isBreakPointQuestion,
} from '@campus-pubquiz/types';
import { GRADED_STATUSES } from '@/game/state/block-grading.service';
import { getGameContext, type SessionState } from '@/game/state/session-state';

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
