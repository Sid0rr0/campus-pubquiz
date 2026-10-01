import {
  advanceFromBlockReview,
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
  getBlockStartPosition,
  getBlockEndPosition,
  getBlockPositionForQuestion,
  getBlockQuestionCount,
  isBreakPointQuestion,
  getRoundAndQuestionForBlockPosition,
} from './game-state-block-position';
export { getTimedPhaseKey } from './game-state-timed-phase';

export function getNextGameState(
  progress: GameProgress,
  action: GameAction,
  context: GameContext,
): GameProgress {
  if (action === 'TOGGLE_MEDIA_FULLSCREEN') {
    return {
      ...progress,
      isMediaFullscreen: !progress.isMediaFullscreen,
    };
  }

  // A monotonic counter rather than a boolean toggle so /display can react
  // to it with a `key` change — doesn't touch isMediaFullscreen, since
  // replaying the video shouldn't exit fullscreen if it's already on.
  if (action === 'REPLAY_MEDIA') {
    return {
      ...progress,
      mediaReplayToken: (progress.mediaReplayToken ?? 0) + 1,
    };
  }

  // The fullscreen view is tied to whatever's currently on screen, so any
  // other action closes it rather than leaving it stuck over unrelated
  // content — every branch below spreads ...progress, so reassigning the
  // local binding here carries the cleared flag through automatically.
  if (progress.isMediaFullscreen) {
    progress = { ...progress, isMediaFullscreen: false };
  }

  if (action === 'TOGGLE_LEADERBOARD') {
    return {
      ...progress,
      isLeaderboardVisible: !progress.isLeaderboardVisible,
    };
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
          status: context.showRoundOverview ? 'round_overview' : 'round_intro',
          roundIndex: 0,
          questionIndex: 0,
          revealIndex: 0,
        };
      }
      if (progress.status === 'round_overview') {
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
        const round = context.rounds[progress.roundIndex];
        const revealIndex =
          getBlockQuestionCount(
            progress.roundIndex,
            progress.questionIndex,
            context,
          ) - 1;
        // Kahoot rounds skip break_intro/break/reveal_intro entirely — every
        // question is auto-graded, so there's never a manual-grading gate to
        // wait through, and the "fewer clicks" design collapses straight to
        // this question's own reveal.
        if (round.kahootMode) {
          return { ...progress, status: 'reveal', revealIndex };
        }
        return {
          ...progress,
          status: 'break_intro',
          // Pins to the block's last question — the one that just locked —
          // so PREVIOUS reveals it directly instead of starting pinned to
          // the block's first question.
          revealIndex,
        };
      }
      // break_intro is always pinned to the block's last question (see
      // 'locking' above), so this always falls into advanceFromBlockReview's
      // "already at the last question" branch and leaves straight to
      // reveal_intro — same outcome as before, just routed through the
      // shared helper. 'break' itself steps forward one question at a time,
      // mirroring how Previous steps backward, so browsing back with
      // Previous and forward again with Advance lands back where you were
      // instead of re-attempting to leave the block (and re-tripping the
      // ungraded-answers gate) on every click.
      if (progress.status === 'break_intro' || progress.status === 'break') {
        return advanceFromBlockReview(progress, context);
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
      if (progress.status === 'round_overview')
        return {
          ...progress,
          status: 'rules',
          questionIndex: 0,
          revealIndex: 0,
        };
      if (progress.status === 'round_intro')
        return previousFromRoundIntro(progress, context);
      if (progress.status === 'question_open')
        return previousFromQuestionOpen(progress, context);
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
