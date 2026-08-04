export type GameStatus =
  | 'lobby'
  | 'rules'
  | 'round_intro'
  | 'question_open'
  | 'locking'
  | 'break_intro'
  | 'break'
  | 'reveal_intro'
  | 'reveal'
  | 'ended';

export type GameAction =
  | 'START_QUIZ'
  | 'ADVANCE'
  | 'PREVIOUS'
  | 'END_QUIZ'
  | 'TOGGLE_LEADERBOARD'
  | 'REVEAL_NEXT_TEAM';

export interface RoundConfig {
  questionCount: number;
  /**
   * Whether a grading break follows this round. Questions stay open for
   * (re-)answering until the block ends: advancing past the last question of a
   * breakAfter round locks every question since the previous breakAfter round.
   */
  breakAfter: boolean;
}

export interface GameContext {
  rounds: RoundConfig[];
}

export interface QuizStructureSummary {
  /** Number of grading breaks — each block of rounds between breaks, inclusive of the final one. */
  blockCount: number;
  /** Rounds ("topics") per block, or null when blocks don't all have the same count. */
  topicsPerBlock: number | null;
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
export function getQuizStructureSummary(context: GameContext): QuizStructureSummary {
  const blockSizes = getBlockSizes(context);
  const isUniform = blockSizes.every((size) => size === blockSizes[0]);
  return {
    blockCount: blockSizes.length,
    topicsPerBlock: isUniform ? (blockSizes[0] ?? null) : null,
  };
}

export interface GameProgress {
  status: GameStatus;
  roundIndex: number;
  questionIndex: number;
  isLeaderboardVisible: boolean;
  /**
   * Position within the just-finished block's flattened question list,
   * shown one at a time (same layout as question_open) during reveal, or
   * browsed backward via Previous during break for review. Set to the
   * block's last question on entering 'break_intro' (carried unchanged into
   * 'break'), and to a question's position on entering 'reveal_intro'
   * (carried unchanged into 'reveal'). Meaningless outside
   * 'break_intro'/'break'/'reveal_intro'/'reveal'.
   */
  revealIndex: number;
}

export class IllegalGameTransitionError extends Error {
  constructor(
    public readonly status: GameStatus,
    public readonly action: GameAction,
  ) {
    super(`Cannot apply action "${action}" from state "${status}"`);
    this.name = 'IllegalGameTransitionError';
  }
}

export class InvalidQuizConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidQuizConfigError';
  }
}

function illegal(status: GameStatus, action: GameAction): never {
  throw new IllegalGameTransitionError(status, action);
}

/**
 * First round of the block containing `roundIndex`: the round after the
 * nearest earlier breakAfter round, or round 0. A breakAfter round closes its
 * own block, so it belongs to the block that starts after the previous break.
 */
export function getBlockStartRoundIndex(roundIndex: number, context: GameContext): number {
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

function advanceFromQuestionOpen(progress: GameProgress, context: GameContext): GameProgress {
  const round = context.rounds[progress.roundIndex];
  const isLastQuestionInRound = progress.questionIndex + 1 >= round.questionCount;

  if (!isLastQuestionInRound) {
    return { ...progress, status: 'question_open', questionIndex: progress.questionIndex + 1 };
  }

  if (round.breakAfter) {
    return { ...progress, status: 'locking' };
  }

  const isLastRound = progress.roundIndex + 1 >= context.rounds.length;
  if (isLastRound) {
    throw new InvalidQuizConfigError(
      `Round ${progress.roundIndex} is the last round but has breakAfter: false — its answers could never be revealed.`,
    );
  }

  return { ...progress, status: 'round_intro', roundIndex: progress.roundIndex + 1, questionIndex: 0 };
}

/**
 * Steps back to the previous question, or — at a round's first question —
 * back to that round's intro card, since every round is now entered through
 * one. Never needs to jump across a round boundary directly.
 */
function previousFromQuestionOpen(progress: GameProgress): GameProgress {
  if (progress.questionIndex > 0) {
    return { ...progress, questionIndex: progress.questionIndex - 1 };
  }

  return { ...progress, status: 'round_intro', questionIndex: 0 };
}

/**
 * Steps back from a round's intro card to whatever preceded it: the rules
 * screen before round 0, the previous round's last question if it ran in the
 * same open block (no break), or the previous block's last reveal question
 * if a break/reveal already ran.
 */
function previousFromRoundIntro(progress: GameProgress, context: GameContext): GameProgress {
  if (progress.roundIndex === 0) {
    return { ...progress, status: 'rules', questionIndex: 0, revealIndex: 0 };
  }

  const previousRoundIndex = progress.roundIndex - 1;
  const previousRound = context.rounds[previousRoundIndex];

  if (!previousRound.breakAfter) {
    return {
      ...progress,
      status: 'question_open',
      roundIndex: previousRoundIndex,
      questionIndex: previousRound.questionCount - 1,
    };
  }

  return enterPreviousBlockReveal(progress, context);
}

/** Total questions across the block containing `roundIndex` (all rounds since the last break, inclusive). */
function getBlockQuestionCount(roundIndex: number, context: GameContext): number {
  const blockStart = getBlockStartRoundIndex(roundIndex, context);
  let count = 0;
  for (let index = blockStart; index <= roundIndex; index += 1) {
    count += context.rounds[index].questionCount;
  }
  return count;
}

/**
 * Jumps back into the last question of the block immediately before the one
 * containing `progress.roundIndex`, in 'reveal' status — that block's answers
 * already aired live, so re-entering it re-shows them rather than reopening
 * anything for (re-)answering. Illegal when there is no earlier block.
 */
function enterPreviousBlockReveal(progress: GameProgress, context: GameContext): GameProgress {
  const blockStart = getBlockStartRoundIndex(progress.roundIndex, context);
  if (blockStart === 0) {
    illegal(progress.status, 'PREVIOUS');
  }

  const previousBlockLastRoundIndex = blockStart - 1;
  const previousRound = context.rounds[previousBlockLastRoundIndex];
  return {
    ...progress,
    status: 'reveal',
    roundIndex: previousBlockLastRoundIndex,
    questionIndex: previousRound.questionCount - 1,
    revealIndex: getBlockQuestionCount(previousBlockLastRoundIndex, context) - 1,
  };
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

/** True when block position `position` is the first question of its round within the block — including the block's very first question. */
function isFirstQuestionOfItsRound(
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

function advanceFromReveal(progress: GameProgress, context: GameContext): GameProgress {
  const blockStart = getBlockStartRoundIndex(progress.roundIndex, context);
  const blockQuestionCount = getBlockQuestionCount(progress.roundIndex, context);
  if (progress.revealIndex + 1 < blockQuestionCount) {
    const nextRevealIndex = progress.revealIndex + 1;
    // Crossing into a new round within the same block: show that round's
    // name before its answers, same as round_intro before its questions.
    if (isFirstQuestionOfItsRound(blockStart, nextRevealIndex, context)) {
      return { ...progress, status: 'reveal_intro', revealIndex: nextRevealIndex };
    }
    return { ...progress, revealIndex: nextRevealIndex };
  }

  const isLastRound = progress.roundIndex + 1 >= context.rounds.length;
  if (isLastRound) {
    return { ...progress, status: 'ended', revealIndex: 0 };
  }

  return {
    ...progress,
    status: 'round_intro',
    roundIndex: progress.roundIndex + 1,
    questionIndex: 0,
    revealIndex: 0,
  };
}

/**
 * Steps backward within the current block during break review; once at the
 * block's first question, crosses into the previous block's reveal instead
 * of rejecting, so a whole quiz's worth of already-locked questions stays
 * reachable by Previous.
 */
function previousFromBlockReview(progress: GameProgress, context: GameContext): GameProgress {
  if (progress.revealIndex > 0) {
    return { ...progress, revealIndex: progress.revealIndex - 1 };
  }
  return enterPreviousBlockReveal(progress, context);
}

/**
 * Steps back from a reveal question to its own round's intro card whenever
 * it's the first question of that round (mirroring previousFromQuestionOpen)
 * — otherwise just the previous reveal question in the same round.
 */
function previousFromReveal(progress: GameProgress, context: GameContext): GameProgress {
  const blockStart = getBlockStartRoundIndex(progress.roundIndex, context);
  if (isFirstQuestionOfItsRound(blockStart, progress.revealIndex, context)) {
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
function previousFromRevealIntro(progress: GameProgress, context: GameContext): GameProgress {
  if (progress.revealIndex === 0) {
    return {
      ...progress,
      status: 'break',
      revealIndex: getBlockQuestionCount(progress.roundIndex, context) - 1,
    };
  }
  return { ...progress, status: 'reveal', revealIndex: progress.revealIndex - 1 };
}

export function getNextGameState(
  progress: GameProgress,
  action: GameAction,
  context: GameContext,
): GameProgress {
  if (action === 'TOGGLE_LEADERBOARD') {
    return { ...progress, isLeaderboardVisible: !progress.isLeaderboardVisible };
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
    return { ...progress, status: 'ended' };
  }

  switch (action) {
    case 'START_QUIZ':
      if (progress.status !== 'lobby') illegal(progress.status, action);
      return { ...progress, status: 'rules', roundIndex: 0, questionIndex: 0, revealIndex: 0 };

    case 'ADVANCE':
      if (progress.status === 'rules') {
        return { ...progress, status: 'round_intro', roundIndex: 0, questionIndex: 0, revealIndex: 0 };
      }
      if (progress.status === 'round_intro') {
        return { ...progress, status: 'question_open', questionIndex: 0 };
      }
      if (progress.status === 'question_open') return advanceFromQuestionOpen(progress, context);
      if (progress.status === 'locking') {
        return {
          ...progress,
          status: 'break_intro',
          // Starts break review at the block's last question — the one that
          // just locked — so Previous can walk backward through the block
          // from there instead of starting pinned to its first question.
          revealIndex: getBlockQuestionCount(progress.roundIndex, context) - 1,
        };
      }
      if (progress.status === 'break_intro') return { ...progress, status: 'break' };
      if (progress.status === 'break') {
        // Reveal always opens on the block's first round's intro card before
        // any answer is shown, same as round_intro precedes question_open.
        return { ...progress, status: 'reveal_intro', revealIndex: 0 };
      }
      if (progress.status === 'reveal_intro') return { ...progress, status: 'reveal' };
      if (progress.status === 'reveal') return advanceFromReveal(progress, context);
      return illegal(progress.status, action);

    case 'PREVIOUS':
      if (progress.status === 'round_intro') return previousFromRoundIntro(progress, context);
      if (progress.status === 'question_open') return previousFromQuestionOpen(progress);
      if (progress.status === 'locking') return { ...progress, status: 'question_open' };
      if (progress.status === 'break_intro') return { ...progress, status: 'locking' };
      if (progress.status === 'break') return previousFromBlockReview(progress, context);
      if (progress.status === 'reveal_intro') return previousFromRevealIntro(progress, context);
      if (progress.status === 'reveal') return previousFromReveal(progress, context);
      return illegal(progress.status, action);
  }
}
