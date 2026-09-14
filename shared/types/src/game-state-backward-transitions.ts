import {
  getBlockPositionForQuestion,
  getBlockQuestionCount,
  getBlockStartPosition,
  getPreviousQuestionPosition,
  getRoundAndQuestionForBlockPosition,
  isFirstQuestionOfItsRound,
  type QuestionPosition,
} from './game-state-block-position';
import {
  illegal,
  type GameContext,
  type GameProgress,
} from './game-state-types';

/**
 * Steps back to the previous question, or — at a round's first question —
 * back to that round's intro card, since every round is now entered through
 * one. Never needs to jump across a round boundary directly. In a kahootMode
 * round, the previous question is already locked/scored/revealed (each
 * question is its own one-question block) — Previous re-enters its reveal
 * rather than reopening it for (re-)answering.
 */
export function previousFromQuestionOpen(
  progress: GameProgress,
  context: GameContext,
): GameProgress {
  const round = context.rounds[progress.roundIndex];

  if (progress.questionIndex > 0) {
    if (round.kahootMode) {
      return {
        ...progress,
        status: 'reveal',
        questionIndex: progress.questionIndex - 1,
        revealIndex: 0,
      };
    }
    return { ...progress, questionIndex: progress.questionIndex - 1 };
  }

  return { ...progress, status: 'round_intro', questionIndex: 0 };
}

/**
 * Steps back from a round's intro card to whatever preceded it: the rules
 * screen (or round_overview, when context.showRoundOverview) before round 0,
 * the previous round's last question if it ran in the same open block (no
 * break, and not kahootMode — a kahootMode round's questions are never
 * reopenable once past), or the previous block's last reveal question if a
 * break/reveal already ran.
 */
export function previousFromRoundIntro(
  progress: GameProgress,
  context: GameContext,
): GameProgress {
  if (progress.roundIndex === 0) {
    return {
      ...progress,
      status: context.showRoundOverview ? 'round_overview' : 'rules',
      questionIndex: 0,
      revealIndex: 0,
    };
  }

  const previousRoundIndex = progress.roundIndex - 1;
  const previousRound = context.rounds[previousRoundIndex];

  if (!previousRound.breakAfter && !previousRound.kahootMode) {
    return {
      ...progress,
      status: 'question_open',
      roundIndex: previousRoundIndex,
      questionIndex: previousRound.questionCount - 1,
    };
  }

  return enterPreviousBlockReveal(progress, context);
}

/**
 * Jumps back into the last question of the block immediately before the one
 * starting at `progress.roundIndex`'s first question, in 'reveal' status —
 * that block's answers already aired live, so re-entering it re-shows them
 * rather than reopening anything for (re-)answering. Illegal when there is
 * no earlier block.
 */
function enterPreviousBlockReveal(
  progress: GameProgress,
  context: GameContext,
): GameProgress {
  const currentBlockStart = getBlockStartPosition(
    progress.roundIndex,
    0,
    context,
  );
  const previousBlockEnd = getPreviousQuestionPositionOrIllegal(
    currentBlockStart,
    progress,
    context,
  );
  const revealIndex = getBlockPositionForQuestion(
    previousBlockEnd.roundIndex,
    previousBlockEnd.questionIndex,
    context,
  );
  return {
    ...progress,
    status: 'reveal',
    roundIndex: previousBlockEnd.roundIndex,
    questionIndex: previousBlockEnd.questionIndex,
    revealIndex,
  };
}

/** The question right before `position`, or throws IllegalGameTransitionError when `position` is the quiz's very first question (no earlier block to cross into). */
function getPreviousQuestionPositionOrIllegal(
  position: QuestionPosition,
  progress: GameProgress,
  context: GameContext,
): QuestionPosition {
  const previous = getPreviousQuestionPosition(position, context);
  if (previous === null) {
    illegal(progress.status, 'PREVIOUS');
  }
  return previous;
}

/**
 * Steps backward within the current block during break review, pausing on a
 * round's own title card (mirroring previousFromReveal) whenever revealIndex
 * lands on that round's first question — including the block's very first
 * question, so round 1's title stays reachable purely by walking Previous.
 */
export function previousFromBlockReview(
  progress: GameProgress,
  context: GameContext,
): GameProgress {
  const blockStart = getBlockStartPosition(
    progress.roundIndex,
    progress.questionIndex,
    context,
  );
  const { questionIndex } = getRoundAndQuestionForBlockPosition(
    blockStart,
    progress.revealIndex,
    context,
  );
  if (isFirstQuestionOfItsRound(questionIndex)) {
    return { ...progress, status: 'break_round_intro' };
  }
  return { ...progress, revealIndex: progress.revealIndex - 1 };
}

/**
 * Steps back from a break round's title card: into the same block's previous
 * round at its last question (still 'break', never 'reveal' — these answers
 * haven't been publicly revealed), or — at the block's very first question —
 * crosses into the previous block's reveal instead of rejecting, so a whole
 * quiz's worth of already-locked questions stays reachable by Previous.
 */
export function previousFromBreakRoundIntro(
  progress: GameProgress,
  context: GameContext,
): GameProgress {
  if (progress.revealIndex === 0) {
    return enterPreviousBlockReveal(progress, context);
  }
  return {
    ...progress,
    status: 'break',
    revealIndex: progress.revealIndex - 1,
  };
}

/**
 * Steps back from a reveal question to its own round's intro card whenever
 * it's the first question of that round (mirroring previousFromQuestionOpen)
 * — otherwise just the previous reveal question in the same round. A
 * kahootMode round never has a reveal_intro to step back to (it's collapsed
 * away) — Previous instead re-opens the locking countdown for this same
 * question.
 */
export function previousFromReveal(
  progress: GameProgress,
  context: GameContext,
): GameProgress {
  const round = context.rounds[progress.roundIndex];
  if (round.kahootMode) {
    return { ...progress, status: 'locking' };
  }

  const blockStart = getBlockStartPosition(
    progress.roundIndex,
    progress.questionIndex,
    context,
  );
  const { questionIndex } = getRoundAndQuestionForBlockPosition(
    blockStart,
    progress.revealIndex,
    context,
  );
  if (isFirstQuestionOfItsRound(questionIndex)) {
    return { ...progress, status: 'reveal_intro' };
  }
  return { ...progress, revealIndex: progress.revealIndex - 1 };
}

/**
 * Steps back from a reveal round's intro card to the previous round's last
 * reveal question, or — at the block's very first round — back into that
 * same block's break (its own grading review), the exact inverse of
 * break's ADVANCE into 'reveal_intro'. Crossing into an earlier block only
 * happens by continuing Previous from within that break review, once it's
 * walked all the way back to the block's first question.
 */
export function previousFromRevealIntro(
  progress: GameProgress,
  context: GameContext,
): GameProgress {
  if (progress.revealIndex === 0) {
    return {
      ...progress,
      status: 'break',
      revealIndex:
        getBlockQuestionCount(
          progress.roundIndex,
          progress.questionIndex,
          context,
        ) - 1,
    };
  }
  return {
    ...progress,
    status: 'reveal',
    revealIndex: progress.revealIndex - 1,
  };
}

/**
 * Undoes the transition into 'ended', restoring whatever status was active
 * right before it — recorded in previousStatus by both paths that reach
 * 'ended' (END_QUIZ, and advanceFromReveal's natural end). Every other
 * field (roundIndex, questionIndex, revealIndex, furthestOpenIndex) was
 * already carried through untouched by both paths, so this is a pure "undo
 * the last transition," not a recomputation. Illegal when there's no
 * recorded previousStatus — a legacy session that reached 'ended' before
 * this field existed.
 */
export function previousFromEnded(progress: GameProgress): GameProgress {
  if (!progress.previousStatus) {
    illegal(progress.status, 'PREVIOUS');
  }
  return { ...progress, status: progress.previousStatus, previousStatus: null };
}
