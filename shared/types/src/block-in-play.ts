import {
  type GameContext,
  type GameProgress,
  getBlockPositionForQuestion,
  getBlockStartPosition,
  getRoundAndQuestionForBlockPosition,
  isAnsweringStatus,
  isBlockStartedStatus,
} from './game-state';

/** The part of a seeded round the Block module reads — a SeededRound fits. */
interface BlockRound {
  breakAfter: boolean;
  kahootMode?: boolean;
  questions: readonly { id: number }[];
}

/** One question of the block in play: where it sits in the quiz and which question it is. */
export interface BlockInPlayPosition {
  roundIndex: number;
  questionIndex: number;
  questionId: number;
}

function toGameContext(rounds: readonly BlockRound[]): GameContext {
  return {
    rounds: rounds.map((round) => ({
      questionCount: round.questions.length,
      breakAfter: round.breakAfter,
      kahootMode: round.kahootMode ?? false,
    })),
  };
}

/**
 * Where the block in play ends, as a block-relative position (the numbering
 * of furthestOpenIndex): -1 when nothing in it has been reached.
 */
function getBlockBoundary(
  progress: GameProgress,
  context: GameContext,
): number {
  const { status, roundIndex, questionIndex, furthestOpenIndex } = progress;

  // While answering, Previous never hides a question already opened, so the
  // block runs to the furthest opened question — not the one on screen. A
  // round intro over a fresh round still has furthestOpenIndex pointing at
  // the earlier round, which is exactly right: nothing of the new round is
  // opened yet.
  if (isAnsweringStatus(status)) return furthestOpenIndex;

  // At ended the block is the last one played, up to where progress stands,
  // so the admin can still review and grade its answers after the reveal.
  // This follows the question on screen, not furthestOpenIndex: if End Quiz
  // was pressed mid-block after Previous, questions opened past the one on
  // screen fall outside it. That is today's behaviour, kept on purpose.
  if (status === 'ended') {
    return getBlockPositionForQuestion(roundIndex, questionIndex, context);
  }

  // Once the block has locked (break, reveal and their intro cards), it is
  // the whole block: progress stands on the block's last question.
  return getBlockPositionForQuestion(roundIndex, questionIndex, context);
}

/**
 * The block in play for `progress`: the questions of the current block the
 * session has reached, in play order.
 *
 * - While answering (question open or locking, or a round intro over already
 *   opened questions): the current block up to its furthest opened question.
 * - Once the block has locked (break, reveal and their intro cards): the
 *   whole block.
 * - At `ended`: the last block played, up to where progress stands.
 * - Otherwise (lobby, rules, round overview): empty.
 *
 * Pure: it needs only the quiz's rounds and a progress, so a caller asking
 * about the progress a press is moving to passes that progress directly.
 */
export function getBlockInPlay(
  rounds: readonly BlockRound[],
  progress: GameProgress,
): BlockInPlayPosition[] {
  if (!isBlockStartedStatus(progress.status)) return [];

  const context = toGameContext(rounds);
  const boundary = getBlockBoundary(progress, context);
  // -1: a fresh block, nothing opened yet.
  if (boundary < 0) return [];

  const blockStart = getBlockStartPosition(
    progress.roundIndex,
    progress.questionIndex,
    context,
  );
  return Array.from({ length: boundary + 1 }, (_, position) => {
    const { roundIndex, questionIndex } = getRoundAndQuestionForBlockPosition(
      blockStart,
      position,
      context,
    );
    return {
      roundIndex,
      questionIndex,
      questionId: rounds[roundIndex].questions[questionIndex].id,
    };
  });
}

/** Just the question ids of the block in play, in play order — what most callers need. */
export function getBlockInPlayIds(
  rounds: readonly BlockRound[],
  progress: GameProgress,
): number[] {
  return getBlockInPlay(rounds, progress).map(({ questionId }) => questionId);
}

/**
 * The question ids of every block that finished before the one `progress` is
 * in: every round before the block's round, plus the questions of a kahoot
 * round that come before the block's start. Same set as
 * getPastRevealedQuestions, asked of a progress and answered in ids.
 */
export function getPastBlockIds(
  rounds: readonly BlockRound[],
  progress: GameProgress,
): number[] {
  const blockStart = getBlockStartPosition(
    progress.roundIndex,
    progress.questionIndex,
    toGameContext(rounds),
  );
  const ids = (round: BlockRound, count = round.questions.length) =>
    round.questions.slice(0, count).map(({ id }) => id);
  return [
    ...rounds.slice(0, blockStart.roundIndex).flatMap((round) => ids(round)),
    ...(blockStart.questionIndex > 0
      ? ids(rounds[blockStart.roundIndex], blockStart.questionIndex)
      : []),
  ];
}
