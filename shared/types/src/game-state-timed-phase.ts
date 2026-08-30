import {
  getBlockPositionForQuestion,
  getBlockStartRoundIndex,
} from './game-state-block-position';
import type { GameContext, GameProgress } from './game-state-types';

/**
 * Identity of the "timed phase" `progress` is currently in — one question
 * still being shown (question_open/locking), or one grading block still
 * being reviewed (break_intro/break/break_round_intro) — or null when the
 * current status isn't timed at all. Stable across the sub-statuses within
 * each phase so browsing within it (locking a question, or stepping between
 * rounds within one break) never looks like a new phase.
 */
export function getTimedPhaseKey(
  progress: GameProgress,
  context: GameContext,
): string | null {
  if (progress.status === 'question_open' || progress.status === 'locking') {
    const blockStart = getBlockStartRoundIndex(progress.roundIndex, context);
    const position = getBlockPositionForQuestion(
      progress.roundIndex,
      progress.questionIndex,
      context,
    );
    return `q:${blockStart}:${position}`;
  }
  if (
    progress.status === 'break_intro' ||
    progress.status === 'break' ||
    progress.status === 'break_round_intro'
  ) {
    return `b:${getBlockStartRoundIndex(progress.roundIndex, context)}`;
  }
  return null;
}
