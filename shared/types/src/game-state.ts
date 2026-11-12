import {
  advanceFromAnswers,
  advanceFromBlockReview,
  advanceFromQuestionOpen,
  advanceFromReveal,
} from './game-state-forward-transitions';
import {
  previousFromAnswers,
  previousFromAnswersIntro,
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
import { isJoinOverlayAllowedStatus } from './game-state-groups';
import {
  illegal,
  type GameAction,
  type GameContext,
  type GameProgress,
  type GameStatus,
} from './game-state-types';

export * from './game-state-types';
export * from './game-state-structure';
export * from './game-state-groups';
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
  const next = applyTransition(progress, action, context);
  // The join overlay never outlives the lobby or the end of the quiz, however
  // the transition got there (END_QUIZ, an advance into 'ended', a return to
  // the lobby).
  return next.isJoinOverlayVisible && !isJoinOverlayAllowedStatus(next.status)
    ? { ...next, isJoinOverlayVisible: false }
    : next;
}

function applyTransition(
  progress: GameProgress,
  action: GameAction,
  context: GameContext,
): GameProgress {
  return (
    applyMediaAction(progress, action) ??
    applyMoveAction(settleMedia(progress, action, context), action, context)
  );
}

/** The media actions, which leave everything else untouched; null for any other action. */
function applyMediaAction(
  progress: GameProgress,
  action: GameAction,
): GameProgress | null {
  if (action === 'TOGGLE_MEDIA_FULLSCREEN') {
    return {
      ...progress,
      isMediaFullscreen: !progress.isMediaFullscreen,
    };
  }

  // A monotonic counter rather than a boolean toggle so /display can react
  // to it with a `key` change — doesn't touch isMediaFullscreen, since
  // replaying the video shouldn't exit fullscreen if it's already on.
  // A replay also resumes playback: the remounted player starts fresh.
  if (action === 'REPLAY_MEDIA') {
    return {
      ...progress,
      mediaReplayToken: (progress.mediaReplayToken ?? 0) + 1,
      ...(progress.isMediaPaused ? { isMediaPaused: false } : {}),
    };
  }

  // Like the fullscreen toggle, pausing leaves everything else untouched.
  if (action === 'TOGGLE_MEDIA_PAUSE') {
    return {
      ...progress,
      isMediaPaused: !progress.isMediaPaused,
    };
  }
  return null;
}

function applyMoveAction(
  progress: GameProgress,
  action: GameAction,
  context: GameContext,
): GameProgress {
  switch (action) {
    case 'TOGGLE_LEADERBOARD':
      return toggleLeaderboard(progress);
    case 'TOGGLE_JOIN_OVERLAY':
      return toggleJoinOverlay(progress, action);
    case 'END_QUIZ':
      return endQuiz(progress, action);
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
      return advance(progress, action, context);
    case 'PREVIOUS':
      return previous(progress, action, context);
    default:
      // The media actions were handled before the move actions.
      return illegal(progress.status, action);
  }
}

function settleMedia(
  progress: GameProgress,
  action: GameAction,
  context: GameContext,
): GameProgress {
  // Pause belongs to the question on screen: anything that moves the quiz on
  // (or back) resets it, to playing, or to paused when the session doesn't
  // autoplay (the media stands still, so the first press plays it). Only the
  // two overlays leave it alone, since the quiz carries on underneath them.
  const landsPaused = context.autoplayMedia === false;
  const isPaused = progress.isMediaPaused ?? false;
  const isOverlayToggle =
    action === 'TOGGLE_LEADERBOARD' || action === 'TOGGLE_JOIN_OVERLAY';
  if (isPaused !== landsPaused && !isOverlayToggle) {
    progress = { ...progress, isMediaPaused: landsPaused };
  }

  // The fullscreen view is tied to whatever's currently on screen, so any
  // other action closes it rather than leaving it stuck over unrelated
  // content — every transition spreads the progress it's handed, so the
  // cleared flag carries through automatically.
  if (progress.isMediaFullscreen) {
    progress = { ...progress, isMediaFullscreen: false };
  }
  return progress;
}

function toggleLeaderboard(progress: GameProgress): GameProgress {
  const isLeaderboardVisible = !progress.isLeaderboardVisible;
  // Only one thing covers the big screen: showing the board hides the overlay.
  return {
    ...progress,
    isLeaderboardVisible,
    ...(isLeaderboardVisible && progress.isJoinOverlayVisible
      ? { isJoinOverlayVisible: false }
      : {}),
  };
}

function toggleJoinOverlay(
  progress: GameProgress,
  action: GameAction,
): GameProgress {
  if (!isJoinOverlayAllowedStatus(progress.status)) {
    illegal(progress.status, action);
  }
  const isJoinOverlayVisible = !progress.isJoinOverlayVisible;
  // Showing the overlay hides the leaderboard (the Settle step resets its reveal).
  return {
    ...progress,
    isJoinOverlayVisible,
    ...(isJoinOverlayVisible ? { isLeaderboardVisible: false } : {}),
  };
}

function endQuiz(progress: GameProgress, action: GameAction): GameProgress {
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

type Transition = (
  progress: GameProgress,
  context: GameContext,
) => GameProgress;

/** Back to the first round's start, at `status`. */
function toQuizStart(progress: GameProgress, status: GameStatus): GameProgress {
  return {
    ...progress,
    status,
    roundIndex: 0,
    questionIndex: 0,
    revealIndex: 0,
  };
}

function advanceFromRules(
  progress: GameProgress,
  context: GameContext,
): GameProgress {
  return toQuizStart(
    progress,
    context.showRoundOverview ? 'round_overview' : 'round_intro',
  );
}

function advanceFromRoundOverview(
  progress: GameProgress,
  context: GameContext,
): GameProgress {
  return toQuizStart(
    progress,
    context.jokersEnabled ? 'joker_pick' : 'round_intro',
  );
}

function advanceFromRoundIntro(
  progress: GameProgress,
  context: GameContext,
): GameProgress {
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

function advanceFromLocking(
  progress: GameProgress,
  context: GameContext,
): GameProgress {
  const round = context.rounds[progress.roundIndex];
  const revealIndex =
    getBlockQuestionCount(
      progress.roundIndex,
      progress.questionIndex,
      context,
    ) - 1;
  // Quickfire rounds skip break_intro/break/reveal_intro entirely — every
  // question is auto-graded, so there's never a manual-grading gate to
  // wait through, and the "fewer clicks" design collapses straight to
  // this question's own reveal.
  if (round.quickfire) {
    return { ...progress, status: 'reveal', revealIndex };
  }
  if (context.earlyAnswerReveal) {
    return { ...progress, status: 'answers_intro', revealIndex: 0 };
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

const ADVANCE_FROM: Partial<Record<GameStatus, Transition>> = {
  rules: advanceFromRules,
  round_overview: advanceFromRoundOverview,
  joker_pick: (progress) => toQuizStart(progress, 'round_intro'),
  round_intro: advanceFromRoundIntro,
  question_open: advanceFromQuestionOpen,
  locking: advanceFromLocking,
  // break_intro is always pinned to the block's last question (see
  // 'locking' above), so this always falls into advanceFromBlockReview's
  // "already at the last question" branch and leaves straight to
  // reveal_intro — same outcome as before, just routed through the
  // shared helper. 'break' itself steps forward one question at a time,
  // mirroring how Previous steps backward, so browsing back with
  // Previous and forward again with Advance lands back where you were
  // instead of re-attempting to leave the block (and re-tripping the
  // ungraded-answers gate) on every click.
  break_intro: advanceFromBlockReview,
  break: advanceFromBlockReview,
  // Resumes into the specific question that was paused on, same as
  // reveal_intro resuming into 'reveal' at the same revealIndex.
  break_round_intro: (progress) => ({ ...progress, status: 'break' }),
  answers_intro: (progress) => ({ ...progress, status: 'answers' }),
  answers: advanceFromAnswers,
  reveal_intro: (progress) => ({ ...progress, status: 'reveal' }),
  reveal: advanceFromReveal,
};

const PREVIOUS_FROM: Partial<Record<GameStatus, Transition>> = {
  // Undoes START_QUIZ: no question has opened yet, so nothing is lost.
  rules: (progress) => toQuizStart(progress, 'lobby'),
  round_overview: (progress) => ({
    ...progress,
    status: 'rules',
    questionIndex: 0,
    revealIndex: 0,
  }),
  joker_pick: (progress) => ({
    ...progress,
    status: 'round_overview',
    questionIndex: 0,
    revealIndex: 0,
  }),
  round_intro: previousFromRoundIntro,
  question_open: previousFromQuestionOpen,
  locking: (progress) => ({ ...progress, status: 'question_open' }),
  // Reveals the specific just-locked question at the same revealIndex —
  // never decrements, so it's never silently skipped past.
  break_intro: (progress, context) => ({
    ...progress,
    status: context.earlyAnswerReveal ? 'answers' : 'break',
  }),
  break: previousFromBlockReview,
  break_round_intro: previousFromBreakRoundIntro,
  answers_intro: previousFromAnswersIntro,
  answers: previousFromAnswers,
  reveal_intro: previousFromRevealIntro,
  reveal: previousFromReveal,
  ended: previousFromEnded,
};

function advance(
  progress: GameProgress,
  action: GameAction,
  context: GameContext,
): GameProgress {
  const transition = ADVANCE_FROM[progress.status];
  return transition
    ? transition(progress, context)
    : illegal(progress.status, action);
}

function previous(
  progress: GameProgress,
  action: GameAction,
  context: GameContext,
): GameProgress {
  const transition = PREVIOUS_FROM[progress.status];
  return transition
    ? transition(progress, context)
    : illegal(progress.status, action);
}
