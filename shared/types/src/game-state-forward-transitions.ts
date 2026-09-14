import {
  getBlockPositionForQuestion,
  getBlockQuestionCount,
  getBlockStartPosition,
  getRoundAndQuestionForBlockPosition,
  isBreakPointQuestion,
  isFirstQuestionOfItsRound,
} from './game-state-block-position';
import {
  InvalidQuizConfigError,
  type GameContext,
  type GameProgress,
} from './game-state-types';

export function advanceFromQuestionOpen(
  progress: GameProgress,
  context: GameContext,
): GameProgress {
  const round = context.rounds[progress.roundIndex];

  if (
    isBreakPointQuestion(progress.roundIndex, progress.questionIndex, context)
  ) {
    return { ...progress, status: 'locking' };
  }

  const isLastQuestionInRound =
    progress.questionIndex + 1 >= round.questionCount;
  if (!isLastQuestionInRound) {
    const questionIndex = progress.questionIndex + 1;
    return {
      ...progress,
      status: 'question_open',
      questionIndex,
      furthestOpenIndex: Math.max(
        progress.furthestOpenIndex,
        getBlockPositionForQuestion(
          progress.roundIndex,
          questionIndex,
          context,
        ),
      ),
    };
  }

  // Last question of the round, but it isn't a break point (breakAfter:
  // false, not kahootMode) — questions stay open and the block continues
  // into the next round without locking anything yet.
  const isLastRound = progress.roundIndex + 1 >= context.rounds.length;
  if (isLastRound) {
    throw new InvalidQuizConfigError(
      `Round ${progress.roundIndex} is the last round but has breakAfter: false — its answers could never be revealed.`,
    );
  }

  return {
    ...progress,
    status: 'round_intro',
    roundIndex: progress.roundIndex + 1,
    questionIndex: 0,
  };
}

export function advanceFromReveal(
  progress: GameProgress,
  context: GameContext,
): GameProgress {
  const round = context.rounds[progress.roundIndex];

  // Kahoot rounds resolve one question at a time — after showing this
  // question's reveal, hop straight into the next question within the same
  // round (a fresh one-question block) instead of treating the round as a
  // finished multi-question block. The next question is opened immediately
  // but sits behind the leaderboard (isLeaderboardVisible: true), same as a
  // finished block below — the admin reveals it via TOGGLE_LEADERBOARD once
  // teams have seen the standings update.
  if (round.kahootMode && progress.questionIndex + 1 < round.questionCount) {
    const questionIndex = progress.questionIndex + 1;
    return {
      ...progress,
      status: 'question_open',
      questionIndex,
      revealIndex: 0,
      isLeaderboardVisible: true,
      furthestOpenIndex: Math.max(
        progress.furthestOpenIndex,
        getBlockPositionForQuestion(
          progress.roundIndex,
          questionIndex,
          context,
        ),
      ),
    };
  }

  const blockStart = getBlockStartPosition(
    progress.roundIndex,
    progress.questionIndex,
    context,
  );
  const blockQuestionCount = getBlockQuestionCount(
    progress.roundIndex,
    progress.questionIndex,
    context,
  );
  if (progress.revealIndex + 1 < blockQuestionCount) {
    const nextRevealIndex = progress.revealIndex + 1;
    // Crossing into a new round within the same block: show that round's
    // name before its answers, same as round_intro before its questions.
    const { questionIndex: nextQuestionIndex } =
      getRoundAndQuestionForBlockPosition(blockStart, nextRevealIndex, context);
    if (isFirstQuestionOfItsRound(nextQuestionIndex)) {
      return {
        ...progress,
        status: 'reveal_intro',
        revealIndex: nextRevealIndex,
      };
    }
    return { ...progress, revealIndex: nextRevealIndex };
  }

  const isLastRound = progress.roundIndex + 1 >= context.rounds.length;
  if (isLastRound) {
    // Advancing past the last reveal question ends the quiz the same way
    // the admin's explicit "End Quiz" button does — the final leaderboard
    // shouldn't need a second click to appear. revealIndex is left
    // untouched (still the block's last question) so PREVIOUS can restore
    // this exact 'reveal' position without recomputation.
    return {
      ...progress,
      status: 'ended',
      previousStatus: 'reveal',
      isLeaderboardVisible: true,
    };
  }

  // A new block starts here — its questions haven't been opened yet, so the
  // previous block's furthest-open watermark must not leak forward into it.
  // The just-finished block's standings show first, same as the final
  // leaderboard on 'ended' — the admin closes it (TOGGLE_LEADERBOARD) once
  // teams have seen where they stand, which reveals the round_intro card
  // already sitting underneath.
  return {
    ...progress,
    status: 'round_intro',
    roundIndex: progress.roundIndex + 1,
    questionIndex: 0,
    revealIndex: 0,
    furthestOpenIndex: -1,
    isLeaderboardVisible: true,
  };
}
