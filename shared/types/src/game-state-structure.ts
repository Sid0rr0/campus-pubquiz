import type { GameContext, GameProgress, GameStatus } from './game-state-types';

export interface QuizStructureSummary {
  /** Number of grading breaks — each block of rounds between breaks, inclusive of the final one. */
  blockCount: number;
  /** Rounds ("topics") per block, or null when blocks don't all have the same count. */
  topicsPerBlock: number | null;
  /**
   * 1-based round number of every block boundary, in order — e.g. [2, 5, 7]
   * for blocks of size 2, 3, 2. The last entry is the total round count.
   */
  breakRoundNumbers: number[];
  /** Fewest questions in any round. 0 when the quiz has no rounds. */
  minQuestionsPerTopic: number;
  /**
   * Most questions in any round. Equal to minQuestionsPerTopic when every
   * round has the same count (or the quiz has no rounds).
   */
  maxQuestionsPerTopic: number;
}

/**
 * 1-based ordinal of the break that follows the round at `roundIndex`
 * (0-based) — 1 for the quiz's first break, 2 for its second, and so on.
 * `roundIndex` stays pinned to the block's last round throughout
 * break/reveal (see GameProgress.revealIndex), so this is safe to call
 * directly with `progress.roundIndex` during a break status. Returns 0 if
 * `roundIndex` isn't a block-ending round, which shouldn't happen while
 * actually in a break status.
 */
export function getBreakNumber(
  roundIndex: number,
  quizStructure: QuizStructureSummary,
): number {
  const index = quizStructure.breakRoundNumbers.indexOf(roundIndex + 1);
  return index === -1 ? 0 : index + 1;
}

const BREAK_SCREEN_STATUSES: GameStatus[] = [
  'break_intro',
  'break',
  'break_round_intro',
];

/**
 * True while `progress` is showing a break-related screen (break_intro,
 * break, or break_round_intro) for the quiz's *last* break — the one after
 * bonus categories have already stopped being awardable (see
 * getBonusEarnDeadlineText in the frontend's bonus-categories.ts), so
 * there's nothing left to earn.
 */
export function isShowingLastBreak(
  progress: GameProgress,
  quizStructure: QuizStructureSummary,
): boolean {
  if (!BREAK_SCREEN_STATUSES.includes(progress.status)) return false;
  const breakNumber = getBreakNumber(progress.roundIndex, quizStructure);
  return breakNumber > 0 && breakNumber === quizStructure.blockCount;
}

/** Sizes (round counts) of every block, in order — a block ends at each breakAfter round. */
function getBlockSizes(context: GameContext): number[] {
  const sizes: number[] = [];
  let currentSize = 0;
  for (const round of context.rounds) {
    currentSize += 1;
    if (round.breakAfter) {
      sizes.push(currentSize);
      currentSize = 0;
    }
  }
  if (currentSize > 0) {
    sizes.push(currentSize);
  }
  return sizes;
}

/** Summarizes a quiz's round/break shape for display on the rules screen. */
export function getQuizStructureSummary(
  context: GameContext,
): QuizStructureSummary {
  const blockSizes = getBlockSizes(context);
  const isUniform = blockSizes.every((size) => size === blockSizes[0]);
  const breakRoundNumbers: number[] = [];
  let roundNumber = 0;
  for (const size of blockSizes) {
    roundNumber += size;
    breakRoundNumbers.push(roundNumber);
  }
  const questionCounts = context.rounds.map((round) => round.questionCount);
  return {
    blockCount: blockSizes.length,
    topicsPerBlock: isUniform ? (blockSizes[0] ?? null) : null,
    breakRoundNumbers,
    minQuestionsPerTopic:
      questionCounts.length > 0 ? Math.min(...questionCounts) : 0,
    maxQuestionsPerTopic:
      questionCounts.length > 0 ? Math.max(...questionCounts) : 0,
  };
}
