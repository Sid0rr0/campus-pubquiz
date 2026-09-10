export type GameStatus =
  | 'lobby'
  | 'rules'
  | 'round_overview'
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
  | 'REVEAL_NEXT_TEAM'
  | 'TOGGLE_MEDIA_FULLSCREEN';

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
  /**
   * Whether ADVANCE from 'rules' stops on a 'round_overview' screen (listing
   * every round's title) before entering round 0's own 'round_intro' — the
   * session-configurable "spoil the round lineup up front" toggle. Optional,
   * like GameProgress.isMediaFullscreen, so existing GameContext literals
   * across the codebase don't all need updating; undefined behaves as false
   * (today's direct rules -> round_intro jump).
   */
  showRoundOverview?: boolean;
}

export interface GameProgress {
  status: GameStatus;
  roundIndex: number;
  questionIndex: number;
  isLeaderboardVisible: boolean;
  /**
   * Whether the current question's media (image or YouTube) is shown
   * full-viewport on /display — toggled by TOGGLE_MEDIA_FULLSCREEN and
   * cleared automatically by every other action, since the enlarged view is
   * tied to whatever's currently on screen. Optional (unlike
   * isLeaderboardVisible) so the many existing GameProgress literals across
   * the codebase don't all need updating; undefined behaves as false.
   */
  isMediaFullscreen?: boolean;
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
  /**
   * The status that was active immediately before the quiz entered 'ended'
   * (via END_QUIZ or the natural end of the last reveal) — lets PREVIOUS
   * undo into it. Meaningless outside 'status === "ended"'; null/undefined
   * there means there's nowhere for PREVIOUS to go (e.g. a session that
   * reached 'ended' before this field existed).
   */
  previousStatus?: GameStatus | null;
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
