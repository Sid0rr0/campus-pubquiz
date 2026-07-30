export type GameStatus =
  | 'lobby'
  | 'rules'
  | 'round_intro'
  | 'question_open'
  | 'locking'
  | 'break'
  | 'reveal'
  | 'ended';

export type GameAction =
  | 'START_QUIZ'
  | 'ADVANCE'
  | 'PREVIOUS'
  | 'FINISH_GRADING'
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
   * shown one at a time (same layout as question_open) during reveal.
   * Meaningless outside 'reveal'.
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
  const lastQuestionIndex = previousRound.questionCount - 1;

  if (!previousRound.breakAfter) {
    return {
      ...progress,
      status: 'question_open',
      roundIndex: previousRoundIndex,
      questionIndex: lastQuestionIndex,
    };
  }

  return {
    ...progress,
    status: 'reveal',
    roundIndex: previousRoundIndex,
    questionIndex: lastQuestionIndex,
    revealIndex: getBlockQuestionCount(previousRoundIndex, context) - 1,
  };
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

function advanceFromReveal(progress: GameProgress, context: GameContext): GameProgress {
  const blockQuestionCount = getBlockQuestionCount(progress.roundIndex, context);
  if (progress.revealIndex + 1 < blockQuestionCount) {
    return { ...progress, revealIndex: progress.revealIndex + 1 };
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

/** Only steps backward within the reveal block currently on screen. */
function previousFromReveal(progress: GameProgress): GameProgress {
  if (progress.revealIndex === 0) {
    illegal(progress.status, 'PREVIOUS');
  }
  return { ...progress, revealIndex: progress.revealIndex - 1 };
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
      if (progress.status === 'locking') return { ...progress, status: 'break' };
      if (progress.status === 'reveal') return advanceFromReveal(progress, context);
      return illegal(progress.status, action);

    case 'PREVIOUS':
      if (progress.status === 'round_intro') return previousFromRoundIntro(progress, context);
      if (progress.status === 'question_open') return previousFromQuestionOpen(progress);
      if (progress.status === 'locking') return { ...progress, status: 'question_open' };
      if (progress.status === 'reveal') return previousFromReveal(progress);
      return illegal(progress.status, action);

    case 'FINISH_GRADING':
      if (progress.status !== 'break') illegal(progress.status, action);
      return { ...progress, status: 'reveal', revealIndex: 0 };
  }
}
