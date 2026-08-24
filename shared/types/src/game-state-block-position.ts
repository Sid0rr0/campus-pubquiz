import type { GameContext, GameProgress } from './game-state-types';

/**
 * First round of the block containing `roundIndex`: the round after the
 * nearest earlier breakAfter round, or round 0. A breakAfter round closes its
 * own block, so it belongs to the block that starts after the previous break.
 */
export function getBlockStartRoundIndex(
  roundIndex: number,
  context: GameContext,
): number {
  for (let index = roundIndex - 1; index >= 0; index -= 1) {
    if (context.rounds[index].breakAfter) {
      return index + 1;
    }
  }
  return 0;
}

/** True when `progress` is sitting on the last question of a round that grades after itself. */
export function isLastQuestionOfBreakAfterRound(
  progress: GameProgress,
  context: GameContext,
): boolean {
  const round = context.rounds[progress.roundIndex];
  return round.breakAfter && progress.questionIndex + 1 >= round.questionCount;
}

/** Total questions across the block containing `roundIndex` (all rounds since the last break, inclusive). */
export function getBlockQuestionCount(
  roundIndex: number,
  context: GameContext,
): number {
  const blockStart = getBlockStartRoundIndex(roundIndex, context);
  let count = 0;
  for (let index = blockStart; index <= roundIndex; index += 1) {
    count += context.rounds[index].questionCount;
  }
  return count;
}

/** Which round (absolute index) owns block position `position`, counted from `blockStartRoundIndex`'s first question. */
function getRoundIndexForBlockPosition(
  blockStartRoundIndex: number,
  position: number,
  context: GameContext,
): number {
  let remaining = position;
  let roundIndex = blockStartRoundIndex;
  while (remaining >= context.rounds[roundIndex].questionCount) {
    remaining -= context.rounds[roundIndex].questionCount;
    roundIndex += 1;
  }
  return roundIndex;
}

/** Inverse of `getRoundIndexForBlockPosition`: the (roundIndex, questionIndex) pair `position` refers to. */
export function getRoundAndQuestionForBlockPosition(
  blockStartRoundIndex: number,
  position: number,
  context: GameContext,
): { roundIndex: number; questionIndex: number } {
  const roundIndex = getRoundIndexForBlockPosition(
    blockStartRoundIndex,
    position,
    context,
  );
  let consumed = 0;
  for (let index = blockStartRoundIndex; index < roundIndex; index += 1) {
    consumed += context.rounds[index].questionCount;
  }
  return { roundIndex, questionIndex: position - consumed };
}

/** Block-relative position (same numbering as revealIndex/furthestOpenIndex) of a given (roundIndex, questionIndex) pair. */
export function getBlockPositionForQuestion(
  roundIndex: number,
  questionIndex: number,
  context: GameContext,
): number {
  const blockStart = getBlockStartRoundIndex(roundIndex, context);
  let position = questionIndex;
  for (let index = blockStart; index < roundIndex; index += 1) {
    position += context.rounds[index].questionCount;
  }
  return position;
}

/** True when block position `position` is the first question of its round within the block — including the block's very first question. */
export function isFirstQuestionOfItsRound(
  blockStartRoundIndex: number,
  position: number,
  context: GameContext,
): boolean {
  if (position === 0) return true;
  return (
    getRoundIndexForBlockPosition(blockStartRoundIndex, position, context) !==
    getRoundIndexForBlockPosition(blockStartRoundIndex, position - 1, context)
  );
}
