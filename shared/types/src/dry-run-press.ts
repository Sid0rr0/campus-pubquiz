import type { GameAction } from './game-state-types';
import { effectiveActionOf, type MoveStep, planMove } from './move-plan';
import { settleSession } from './session-settle';
import type { SessionState } from './session-state';

/** The Move plan's steps that move the quiz's progress. */
export type ProgressMoveStep = Extract<
  MoveStep,
  {
    kind:
      | 'transition'
      | 'grading_pending'
      | 'leaderboard_reveal'
      | 'leaderboard_hide'
      | 'join_overlay_hide';
  }
>;

/**
 * The Settle step for a progress-moving step, carried out as the action it
 * plans. A raw ADVANCE under the leaderboard settles as the action it plans —
 * ADVANCE for a rank reveal, TOGGLE_LEADERBOARD to hide — so the reveal count,
 * the kahoot timer and everything else downstream treat it identically.
 */
export function settleMove(
  session: SessionState,
  step: ProgressMoveStep,
  pressed: GameAction,
  now: number,
): SessionState {
  return settleSession({
    session,
    progress: step.progress,
    step: { kind: step.kind, action: effectiveActionOf(step, pressed) },
    now,
  });
}

/** What a press would do, with the session as it would then stand. */
export interface PreviewedMove {
  step: MoveStep;
  /** The session after the press; `step`'s own session for the ephemeral steps, the current one for a press that moves nothing. */
  session: SessionState;
}

/**
 * A dry-run press: the same Move plan and Settle step as a real press, with no
 * grading, no showdown resolve and nothing saved. The session passed in is
 * never changed. `now` is the time the press would happen at.
 */
export function previewMove(
  session: SessionState,
  action: GameAction,
  now: number,
): PreviewedMove {
  const step = planMove(session, action);
  switch (step.kind) {
    case 'transition':
    case 'leaderboard_reveal':
    case 'leaderboard_hide':
    case 'join_overlay_hide':
      return { step, session: settleMove(session, step, action, now) };
    case 'reveal_step':
      return { step, session: step.session };
    case 'grading_pending':
    case 'showdown_waiting':
    case 'blocked':
      return { step, session };
  }
}
