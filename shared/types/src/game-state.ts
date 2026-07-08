export type GameStatus = 'lobby' | 'question_open' | 'locked' | 'break' | 'reveal' | 'ended';

export type GameAction =
  | 'START_QUIZ'
  | 'LOCK_ANSWERS'
  | 'ADVANCE'
  | 'FINISH_GRADING'
  | 'END_QUIZ'
  | 'TOGGLE_LEADERBOARD';

export interface RoundConfig {
  questionCount: number;
  /** Whether a grading break follows this round once its last question is locked. */
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

function advanceFromLocked(progress: GameProgress, context: GameContext): GameProgress {
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

    case 'LOCK_ANSWERS':
      if (progress.status !== 'question_open') illegal(progress.status, action);
      return { ...progress, status: 'locked' };

    case 'ADVANCE':
      if (progress.status === 'locked') return advanceFromLocked(progress, context);
      if (progress.status === 'reveal') return advanceFromReveal(progress, context);
      return illegal(progress.status, action);

    case 'FINISH_GRADING':
      if (progress.status !== 'break') illegal(progress.status, action);
      return { ...progress, status: 'reveal' };
  }
}
