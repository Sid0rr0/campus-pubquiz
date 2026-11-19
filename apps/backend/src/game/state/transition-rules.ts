import {
  type GameAction,
  type GameProgress,
  type GameStatus,
  isBreakExit,
  isGradedStatus,
  isRevealingStatus,
  type SessionState,
} from '@campus-pubquiz/types';

/**
 * What a move between two statuses sets off: the named transition facts. The
 * move pipeline reads them; the effects themselves (jokers, carried coins,
 * grading) stay in their own modules. A fact says only that something is
 * needed, never reads the database for it.
 */
export interface TransitionFacts {
  /** Leaving the joker pick by any route: teams without a joker are drawn one. */
  jokerPickCloses: boolean;
  /** Entering the joker pick from anywhere else: drawn jokers are cleared. */
  jokerPickReopens: boolean;
  /** Carried coins are decided, and every team's coins may change. */
  leavesLobby: boolean;
  /** Start quiz from the lobby with Versus on: every roster team needs a side. */
  startNeedsEverySide: boolean;
  /** Advance on a break exit: the block's answers must all be graded. */
  leavingBreakNeedsBlockGraded: boolean;
  /** Leaving locking while the round in play is quickfire. */
  quickfireQuestionSpeedScored: boolean;
  /** The move reaches a graded or revealing status. */
  blockIsGraded: boolean;
  /** Entering reveal intro, quickfire's collapsed lock-to-reveal, or a break exit into a non-revealing status. */
  gradesBecomeVisible: boolean;
  /** A break exit that doesn't go to reveal intro: the board comes first. */
  leavesBreakIntoResults: boolean;
  /** Entering or leaving ended. */
  leagueTablesMayChange: boolean;
}

/** The part of the session before the move that the rules read. */
interface SessionBeforeMove {
  progress: Pick<GameProgress, 'status' | 'roundIndex'>;
  seededGame: {
    settings: Pick<SessionState['seededGame']['settings'], 'versusEnabled'>;
    rounds: readonly { quickfire?: boolean }[];
  };
}

/** The facts for the move from `session`'s progress to `to`, pressed with `pressed` (the timer's auto-lock arrives as ADVANCE). */
export function transitionFacts(
  session: SessionBeforeMove,
  to: Pick<GameProgress, 'status'>,
  pressed: GameAction,
): TransitionFacts {
  const { status: from, roundIndex } = session.progress;
  const next = to.status;
  return {
    jokerPickCloses: leaves(from, next, 'joker_pick'),
    jokerPickReopens: leaves(next, from, 'joker_pick'),
    leavesLobby: leaves(from, next, 'lobby'),
    startNeedsEverySide:
      pressed === 'START_QUIZ' &&
      from === 'lobby' &&
      session.seededGame.settings.versusEnabled,
    leavingBreakNeedsBlockGraded:
      pressed === 'ADVANCE' && isBreakExit(from, next),
    quickfireQuestionSpeedScored:
      leaves(from, next, 'locking') &&
      !!session.seededGame.rounds[roundIndex]?.quickfire,
    blockIsGraded: isGradedStatus(next) || isRevealingStatus(next),
    gradesBecomeVisible: gradesBecomeVisible(from, next),
    leavesBreakIntoResults: isBreakExit(from, next) && next !== 'reveal_intro',
    leagueTablesMayChange: (from === 'ended') !== (next === 'ended'),
  };
}

/** Whether a move is on `status` before and not after. */
function leaves(from: GameStatus, to: GameStatus, status: GameStatus): boolean {
  return from === status && to !== status;
}

/** The three moments a team's grades first reach its phone; with Early answer reveal the break exit is where the verdicts first show. */
function gradesBecomeVisible(from: GameStatus, to: GameStatus): boolean {
  const entersRevealIntro = from !== 'reveal_intro' && to === 'reveal_intro';
  const collapsedQuickfireReveal = from === 'locking' && to === 'reveal';
  const breakIntoResults = isBreakExit(from, to) && !isRevealingStatus(to);
  return entersRevealIntro || collapsedQuickfireReveal || breakIntoResults;
}
