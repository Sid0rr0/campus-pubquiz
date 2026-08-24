export type GameStatus =
  | 'lobby'
  | 'rules'
  | 'round_intro'
  | 'question_open'
  | 'locking'
  | 'break_intro'
  | 'break'
  | 'break_round_intro'
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

export interface GameProgress {
  status: GameStatus;
  roundIndex: number;
  questionIndex: number;
  isLeaderboardVisible: boolean;
  /**
   * Position within the just-finished block's flattened question list,
   * shown one at a time (same layout as question_open) during reveal, or
   * browsed backward via Previous during break for review. Set to the
   * block's last question on entering 'break', and to a question's position
   * on entering 'reveal_intro' (carried unchanged into 'reveal'). Meaningless
   * outside 'break'/'reveal_intro'/'reveal'.
   */
  revealIndex: number;
  /**
   * Furthest position (block-relative, same numbering as revealIndex)
   * reached via ADVANCE while the current block's questions are open —
   * monotonic within a block, so stepping back with Previous never makes an
   * already-shown question unanswerable again. -1 means no question in the
   * current block has ever been opened yet (distinct from 0, a real opened
   * first question) — reset to -1 whenever a new block starts. Relevant
   * during 'question_open'/'locking', and during 'round_intro' to tell a
   * fresh round (nothing open yet, show the intro card) from Previous
   * stepping back into a round whose questions are already open (keep them
   * answerable underneath the card).
   */
  furthestOpenIndex: number;
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

export function illegal(status: GameStatus, action: GameAction): never {
  throw new IllegalGameTransitionError(status, action);
}
