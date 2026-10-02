import {
  describeFeedback,
  getBlockStartPosition,
  type FeedbackField,
} from '@campus-pubquiz/types';
import { getGameContext, type SessionState } from '@/game/state/session-state';

/**
 * The rounds open for rating right now, as the players view carries them and
 * as the rating event is checked — one rule, so the projection and the check
 * can't disagree.
 */
export function getFeedbackField(session: SessionState): FeedbackField {
  const { progress, seededGame } = session;
  const { activeShowdownRound } = session;
  return describeFeedback({
    progress,
    isShowdownBeingPlayed:
      activeShowdownRound !== null && !activeShowdownRound.resolved,
    blockRounds: () => {
      const blockStart = getBlockStartPosition(
        progress.roundIndex,
        progress.questionIndex,
        getGameContext(session),
      );
      return seededGame.rounds
        .slice(blockStart.roundIndex, progress.roundIndex + 1)
        .map(({ id, title }) => ({ id, title }));
    },
    allRounds: () => seededGame.rounds.map(({ id, title }) => ({ id, title })),
  });
}
