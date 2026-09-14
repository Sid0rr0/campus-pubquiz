import type { GameContext } from './game-state-types';

export interface QuestionPosition {
  roundIndex: number;
  questionIndex: number;
}

/**
 * True when locking the question at (roundIndex, questionIndex) ends its
 * block: either it's the last question of a round with breakAfter: true (the
 * original, round-granular rule), or the round is kahootMode — in which case
 * every one of its questions is its own one-question block, locking, scoring,
 * and revealing independently before the next one opens.
 */
export function isBreakPointQuestion(
  roundIndex: number,
  questionIndex: number,
  context: GameContext,
): boolean {
  const round = context.rounds[roundIndex];
  return (
    Boolean(round.kahootMode) ||
    (round.breakAfter && questionIndex + 1 >= round.questionCount)
  );
}

/** The question immediately before `position`, crossing into the previous round's last question when `position` is a round's first — or null when `position` is the quiz's very first question. */
export function getPreviousQuestionPosition(
  position: QuestionPosition,
  context: GameContext,
): QuestionPosition | null {
  if (position.questionIndex > 0) {
    return {
      roundIndex: position.roundIndex,
      questionIndex: position.questionIndex - 1,
    };
  }
  if (position.roundIndex === 0) return null;
  const previousRoundIndex = position.roundIndex - 1;
  return {
    roundIndex: previousRoundIndex,
    questionIndex: context.rounds[previousRoundIndex].questionCount - 1,
  };
}

/** The question immediately after `position`, crossing into the next round's first question when `position` is a round's last — or null when `position` is the quiz's very last question. */
function getNextQuestionPosition(
  position: QuestionPosition,
  context: GameContext,
): QuestionPosition | null {
  const round = context.rounds[position.roundIndex];
  if (position.questionIndex + 1 < round.questionCount) {
    return {
      roundIndex: position.roundIndex,
      questionIndex: position.questionIndex + 1,
    };
  }
  if (position.roundIndex + 1 >= context.rounds.length) return null;
  return { roundIndex: position.roundIndex + 1, questionIndex: 0 };
}

/**
 * First question of the block containing (roundIndex, questionIndex):
 * walking backward, the question right after the nearest earlier break-point
 * question, or the quiz's very first question if none is found. A
 * breakAfter round's last question (or, in kahootMode, every question)
 * closes its own block, so it belongs to the block that starts after the
 * previous break point.
 */
export function getBlockStartPosition(
  roundIndex: number,
  questionIndex: number,
  context: GameContext,
): QuestionPosition {
  // Every kahootMode question is its own block start regardless of the
  // previous question's round — the backward walk below only detects break
  // points on the *previous* question, so a kahootMode round immediately
  // after a non-breakpoint round would otherwise be merged into it.
  if (context.rounds[roundIndex].kahootMode) {
    return { roundIndex, questionIndex };
  }
  let current: QuestionPosition = { roundIndex, questionIndex };
  for (;;) {
    const previous = getPreviousQuestionPosition(current, context);
    if (previous === null) return current;
    if (
      isBreakPointQuestion(previous.roundIndex, previous.questionIndex, context)
    ) {
      return current;
    }
    current = previous;
  }
}

/**
 * Last question of the block containing (roundIndex, questionIndex): walking
 * forward, the nearest question at or after it that is itself a break point,
 * or the quiz's last question if none is found first — every quiz's final
 * question is forced to be a break point (see CLAUDE.md), so this always
 * terminates.
 */
export function getBlockEndPosition(
  roundIndex: number,
  questionIndex: number,
  context: GameContext,
): QuestionPosition {
  let current: QuestionPosition = { roundIndex, questionIndex };
  while (
    !isBreakPointQuestion(current.roundIndex, current.questionIndex, context)
  ) {
    const next = getNextQuestionPosition(current, context);
    if (next === null) return current;
    current = next;
  }
  return current;
}

/** Total questions in the block containing (roundIndex, questionIndex). */
export function getBlockQuestionCount(
  roundIndex: number,
  questionIndex: number,
  context: GameContext,
): number {
  const start = getBlockStartPosition(roundIndex, questionIndex, context);
  const end = getBlockEndPosition(roundIndex, questionIndex, context);
  let count = 1;
  let current = start;
  while (
    current.roundIndex !== end.roundIndex ||
    current.questionIndex !== end.questionIndex
  ) {
    // Non-null: `end` is always reachable forward from `start` within the
    // same block by construction of getBlockStartPosition/getBlockEndPosition.
    current = getNextQuestionPosition(current, context)!;
    count += 1;
  }
  return count;
}

/** Inverse of getBlockPositionForQuestion: the (roundIndex, questionIndex) pair `position` steps forward refers to, counting from `blockStart`. */
export function getRoundAndQuestionForBlockPosition(
  blockStart: QuestionPosition,
  position: number,
  context: GameContext,
): QuestionPosition {
  let current = blockStart;
  for (let i = 0; i < position; i += 1) {
    // Non-null: callers only ever pass a `position` that's within the block
    // starting at `blockStart`.
    current = getNextQuestionPosition(current, context)!;
  }
  return current;
}

/** Block-relative position (same numbering as revealIndex/furthestOpenIndex) of a given (roundIndex, questionIndex) pair, counted from the start of its own block. */
export function getBlockPositionForQuestion(
  roundIndex: number,
  questionIndex: number,
  context: GameContext,
): number {
  const start = getBlockStartPosition(roundIndex, questionIndex, context);
  let position = 0;
  let current = start;
  while (
    current.roundIndex !== roundIndex ||
    current.questionIndex !== questionIndex
  ) {
    current = getNextQuestionPosition(current, context)!;
    position += 1;
  }
  return position;
}

/** True when `questionIndex` is the first question of its round — including a block's very first question. */
export function isFirstQuestionOfItsRound(questionIndex: number): boolean {
  return questionIndex === 0;
}
