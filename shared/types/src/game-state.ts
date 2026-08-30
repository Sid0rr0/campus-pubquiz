import {
  advanceFromQuestionOpen,
  advanceFromReveal,
} from './game-state-forward-transitions';
import {
  previousFromBlockReview,
  previousFromBreakRoundIntro,
  previousFromEnded,
  previousFromQuestionOpen,
  previousFromReveal,
  previousFromRevealIntro,
  previousFromRoundIntro,
} from './game-state-backward-transitions';
import {
  getBlockPositionForQuestion,
  getBlockQuestionCount,
} from './game-state-block-position';
import {
  illegal,
  type GameAction,
  type GameContext,
  type GameProgress,
} from './game-state-types';

export * from './game-state-types';
export * from './game-state-structure';
export {
  getBlockStartRoundIndex,
  isLastQuestionOfBreakAfterRound,
  getRoundAndQuestionForBlockPosition,
} from './game-state-block-position';
export { getTimedPhaseKey } from './game-state-timed-phase';

export function getNextGameState(
  progress: GameProgress,
  action: GameAction,
  context: GameContext,
): GameProgress {
  if (action === 'TOGGLE_LEADERBOARD') {
    return {
      ...progress,
      isLeaderboardVisible: !progress.isLeaderboardVisible,
    };
  }

  // Reveal progress itself isn't part of GameProgress (it's ephemeral,
  // tracked by GameStateService) — this is a no-op on progress, only legal
  // while the board is up, so the caller's side effect has something to act on.
  if (action === 'REVEAL_NEXT_TEAM') {
    if (!progress.isLeaderboardVisible) illegal(progress.status, action);
    return progress;
  }

  if (action === 'END_QUIZ') {
    if (progress.status === 'ended') {
      illegal(progress.status, action);
    }
    // Ending the quiz shows the "Quiz complete!" screen first, not the
    // leaderboard — the admin reveals it afterward via TOGGLE_LEADERBOARD,
    // same as at any other break. previousStatus records what to undo into.
    return {
      ...progress,
      status: 'ended',
      previousStatus: progress.status,
      isLeaderboardVisible: false,
    };
  }

  switch (action) {
    case 'START_QUIZ':
      if (progress.status !== 'lobby') illegal(progress.status, action);
      return {
        ...progress,
        status: 'rules',
        roundIndex: 0,
        questionIndex: 0,
        revealIndex: 0,
      };

    case 'ADVANCE':
      if (progress.status === 'rules') {
        return {
          ...progress,
          status: 'round_intro',
          roundIndex: 0,
          questionIndex: 0,
          revealIndex: 0,
        };
      }
      if (progress.status === 'round_intro') {
        return {
          ...progress,
          status: 'question_open',
          questionIndex: 0,
          furthestOpenIndex: Math.max(
            progress.furthestOpenIndex,
            getBlockPositionForQuestion(progress.roundIndex, 0, context),
          ),
        };
      }
      if (progress.status === 'question_open')
        return advanceFromQuestionOpen(progress, context);
      if (progress.status === 'locking') {
        return {
          ...progress,
          status: 'break_intro',
          // Pins to the block's last question — the one that just locked —
          // so PREVIOUS reveals it directly instead of starting pinned to
          // the block's first question.
          revealIndex: getBlockQuestionCount(progress.roundIndex, context) - 1,
        };
      }
      // Skips straight to revealing, same as 'break' already does from any
      // position — the admin doesn't need to step into the specific
      // just-locked question via ADVANCE; that's what PREVIOUS is for.
      if (progress.status === 'break_intro') {
        return { ...progress, status: 'reveal_intro', revealIndex: 0 };
      }
      if (progress.status === 'break') {
        // Reveal always opens on the block's first round's intro card before
        // any answer is shown, same as round_intro precedes question_open.
        return { ...progress, status: 'reveal_intro', revealIndex: 0 };
      }
      // Resumes into the specific question that was paused on, same as
      // reveal_intro resuming into 'reveal' at the same revealIndex.
      if (progress.status === 'break_round_intro')
        return { ...progress, status: 'break' };
      if (progress.status === 'reveal_intro')
        return { ...progress, status: 'reveal' };
      if (progress.status === 'reveal')
        return advanceFromReveal(progress, context);
      return illegal(progress.status, action);

    case 'PREVIOUS':
      if (progress.status === 'round_intro')
        return previousFromRoundIntro(progress, context);
      if (progress.status === 'question_open')
        return previousFromQuestionOpen(progress);
      if (progress.status === 'locking')
        return { ...progress, status: 'question_open' };
      // Reveals the specific just-locked question at the same revealIndex —
      // never decrements, so it's never silently skipped past.
      if (progress.status === 'break_intro')
        return { ...progress, status: 'break' };
      if (progress.status === 'break')
        return previousFromBlockReview(progress, context);
      if (progress.status === 'break_round_intro')
        return previousFromBreakRoundIntro(progress, context);
      if (progress.status === 'reveal_intro')
        return previousFromRevealIntro(progress, context);
      if (progress.status === 'reveal')
        return previousFromReveal(progress, context);
      if (progress.status === 'ended') return previousFromEnded(progress);
      return illegal(progress.status, action);
  }
}
