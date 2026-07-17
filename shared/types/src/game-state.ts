export type GameStatus = 'lobby' | 'question_open' | 'break' | 'reveal' | 'ended';

export type GameAction =
  | 'START_QUIZ'
  | 'ADVANCE'
  | 'FINISH_GRADING'
  | 'END_QUIZ'
  | 'TOGGLE_LEADERBOARD';

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

export interface GameProgress {
  status: GameStatus;
  roundIndex: number;
  questionIndex: number;
  isLeaderboardVisible: boolean;
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

function advanceFromQuestionOpen(progress: GameProgress, context: GameContext): GameProgress {
  const round = context.rounds[progress.roundIndex];
  const isLastQuestionInRound = progress.questionIndex + 1 >= round.questionCount;

  if (!isLastQuestionInRound) {
    return { ...progress, status: 'question_open', questionIndex: progress.questionIndex + 1 };
  }

  if (round.breakAfter) {
    return { ...progress, status: 'break' };
  }

  const isLastRound = progress.roundIndex + 1 >= context.rounds.length;
  if (isLastRound) {
    throw new InvalidQuizConfigError(
      `Round ${progress.roundIndex} is the last round but has breakAfter: false — its answers could never be revealed.`,
    );
  }

  return { ...progress, status: 'question_open', roundIndex: progress.roundIndex + 1, questionIndex: 0 };
}

function advanceFromReveal(progress: GameProgress, context: GameContext): GameProgress {
  const isLastRound = progress.roundIndex + 1 >= context.rounds.length;

  if (isLastRound) {
    return { ...progress, status: 'ended' };
  }

  return { ...progress, status: 'question_open', roundIndex: progress.roundIndex + 1, questionIndex: 0 };
}

export function getNextGameState(
  progress: GameProgress,
  action: GameAction,
  context: GameContext,
): GameProgress {
  if (action === 'TOGGLE_LEADERBOARD') {
    return { ...progress, isLeaderboardVisible: !progress.isLeaderboardVisible };
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
      return { ...progress, status: 'question_open', roundIndex: 0, questionIndex: 0 };

    case 'ADVANCE':
      if (progress.status === 'question_open') return advanceFromQuestionOpen(progress, context);
      if (progress.status === 'reveal') return advanceFromReveal(progress, context);
      return illegal(progress.status, action);

    case 'FINISH_GRADING':
      if (progress.status !== 'break') illegal(progress.status, action);
      return { ...progress, status: 'reveal' };
  }
}
