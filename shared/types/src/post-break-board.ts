import {
  getBlockStartPosition,
  getPreviousQuestionPosition,
} from './game-state-block-position';
import { isBreakStatus } from './game-state-groups';
import type { GameProgress } from './game-state-types';
import { getGameContext, type SessionState } from './session-state';

/**
 * The post-break leaderboard of the Early answer reveal: the board the break's
 * Advance opened over the next block's `round_intro` (or over `ended`), where
 * phones show the verdicts of the block just graded instead of the board.
 *
 * Returns a progress standing on that graded block (status `reveal`, so the
 * block-reading helpers take it whole), or null when the board is not that
 * one.
 *
 * shortcut: a board the moderator toggles on at a fresh block's round intro
 * reads the same, because the progress alone cannot tell them apart; add a
 * progress flag if that ever matters.
 */
export function getPostBreakBoardBlock(
  session: SessionState,
): GameProgress | null {
  const { progress } = session;
  if (
    !session.seededGame.settings.earlyAnswerReveal ||
    !progress.isLeaderboardVisible
  ) {
    return null;
  }
  if (progress.status === 'ended') {
    return progress.previousStatus && isBreakStatus(progress.previousStatus)
      ? { ...progress, status: 'reveal' }
      : null;
  }
  if (progress.status !== 'round_intro' || progress.furthestOpenIndex >= 0) {
    return null;
  }
  const context = getGameContext(session);
  const blockStart = getBlockStartPosition(
    progress.roundIndex,
    progress.questionIndex,
    context,
  );
  const last = getPreviousQuestionPosition(blockStart, context);
  return last === null
    ? null
    : { ...progress, ...last, status: 'reveal', revealIndex: 0 };
}
