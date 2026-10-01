import type { GameAction, GameProgress } from '@campus-pubquiz/types';
import { BlockGradingService } from '@/game/state/block-grading.service';
import { ShowdownGuessesPendingError } from '@/game/state/errors/showdown-guesses-pending.error';
import { UngradedAnswersError } from '@/game/state/errors/ungraded-answers.error';
import type {
  GameProgressRepository,
  PersistedGameProgress,
} from '@/game/state/game-progress.repository';
import {
  effectiveActionOf,
  planMove,
  type MoveStep,
} from '@/game/state/move-plan.util';
import {
  BROADCAST_STATE_OUTCOME,
  isRevealEntry,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import {
  settleSession,
  type SavedPhaseTimer,
} from '@/game/state/session-settle.util';
import type {
  ActiveShowdownRoundState,
  SessionState,
} from '@/game/state/session-state';
import { withLeaderboard } from '@/game/state/session-updates.util';
import type { StandingsService } from '@/standings/standings.service';
import type { ShowdownService } from '@/showdown/showdown.service';

/** A press carried out: the session as it now stands, and what must be pushed because of it. */
export interface CommittedMove {
  session: SessionState;
  outcome: SessionOutcome;
}

type ProgressMoveStep = Extract<
  MoveStep,
  {
    kind:
      | 'transition'
      | 'grading_pending'
      | 'leaderboard_reveal'
      | 'leaderboard_hide';
  }
>;

/**
 * Carries out one planned press from start to finish — the one place the
 * plan → grade → settle → save pipeline is put together. A press (an admin
 * action or a timer expiry standing in for one), session creation and
 * restart restore all reach a new point through here.
 *
 * It never touches the in-memory session store: the caller stores what
 * `commit` returns, so the session only moves once its progress is saved.
 */
export class MoveCommitter {
  constructor(
    private readonly grading: BlockGradingService,
    private readonly progressRepository: GameProgressRepository,
    private readonly standingsService: StandingsService,
    private readonly showdownService: ShowdownService,
  ) {}

  /**
   * Commits a press. Throws the plan's refusal for a blocked, showdown-waiting
   * or grading-pending step, and whatever a failed grading read or progress
   * save throws — in every case nothing has moved and `session` is still the
   * truth. Grading writes made before a failed save are idempotent; the next
   * press redoes them.
   */
  async commit(
    session: SessionState,
    action: GameAction,
  ): Promise<CommittedMove> {
    const step = planMove(session, action);

    // The ephemeral steps (showdown reveal, closest_guess sub-steps) never
    // reach getNextGameState: GameProgress is untouched and nothing is
    // persisted. See tryStepClosestGuessReveal for why they stay ephemeral.
    switch (step.kind) {
      case 'blocked':
        throw step.cause;
      case 'showdown_waiting':
        throw new ShowdownGuessesPendingError();
      case 'showdown_step':
        return {
          session: await this.resolveShowdownIfFinished(step),
          outcome: BROADCAST_STATE_OUTCOME,
        };
      case 'closest_guess_step':
        return { session: step.session, outcome: BROADCAST_STATE_OUTCOME };
      case 'transition':
      case 'grading_pending':
      case 'leaderboard_reveal':
      case 'leaderboard_hide':
        return this.commitProgressMove(session, action, step);
    }
  }

  /**
   * Places a session at a starting point — the lobby for a new session, the
   * saved progress and phase timer for a restart restore. Refreshes the
   * ungraded set inside the break and settles; nothing is saved.
   */
  async place(
    session: SessionState,
    progress: GameProgress,
    savedPhaseTimer?: SavedPhaseTimer,
  ): Promise<SessionState> {
    // The ungraded cache lives in memory only; inside the break it must be
    // rebuilt so /control and showdown eligibility are right straight away.
    const refreshed = await this.grading.refreshUngradedQuestionIds(
      session,
      progress,
    );
    // A saved phase timer is restored exactly (unlike the auto-lock
    // deadline's deliberate re-arm-fresh) — its epoch-ms start time is real
    // and persisted, so the elapsed time it shows after a restart is still
    // accurate, downtime included.
    return settleSession({
      session: refreshed,
      progress,
      step: { kind: 'place' },
      now: Date.now(),
      savedPhaseTimer,
    });
  }

  private async commitProgressMove(
    session: SessionState,
    pressed: GameAction,
    step: ProgressMoveStep,
  ): Promise<CommittedMove> {
    const { progress } = step;

    await this.assertNothingUngradedLeavingBreak(session, progress);

    const speedScored = await this.grading.ensureKahootSpeedScored(
      session,
      progress,
    );
    const graded = await this.grading.ensureBlockGraded(speedScored, progress);
    const refreshed = await this.grading.refreshUngradedQuestionIds(
      graded,
      progress,
    );
    // A raw ADVANCE under the leaderboard is carried out as the action it
    // plans — ADVANCE for a rank reveal, TOGGLE_LEADERBOARD to hide — so the
    // reveal count, the kahoot timer and everything else downstream treat it
    // identically.
    const action = effectiveActionOf(step, pressed);
    const settled = settleSession({
      session: refreshed,
      progress,
      step: { kind: step.kind, action },
      now: Date.now(),
    });
    const committed = await this.withBoardFreshIfTurnedOn(settled, action);

    await this.progressRepository.save(
      committed.seededGame.gameSessionId,
      toPersistedProgress(committed),
    );
    return {
      session: committed,
      outcome: {
        ...BROADCAST_STATE_OUTCOME,
        teamSyncTeamIds: isRevealEntry(session.progress.status, progress.status)
          ? getConnectedTeamIds(committed)
          : [],
      },
    };
  }

  /**
   * Committing out of the break/grading screens into reveal — the one moment
   * this must be DB-authoritative rather than relying on the (possibly stale,
   * e.g. post-restart) ungradedQuestionIds cache the plan and the refresh read.
   */
  private async assertNothingUngradedLeavingBreak(
    session: SessionState,
    progress: GameProgress,
  ): Promise<void> {
    const { status } = session.progress;
    const isLeavingBreak = status === 'break_intro' || status === 'break';
    if (!isLeavingBreak || progress.status !== 'reveal_intro') return;

    const ungradedQuestionIds =
      await this.grading.getUngradedBlockQuestionIds(session);
    if (ungradedQuestionIds.length > 0) {
      throw new UngradedAnswersError(ungradedQuestionIds);
    }
  }

  /**
   * Answers and grades refresh the leaderboard, but a team that hasn't
   * answered yet isn't on it — recompute fresh when the board is turned on so
   * every currently-joined team appears, 0 points and all.
   */
  private async withBoardFreshIfTurnedOn(
    session: SessionState,
    action: GameAction,
  ): Promise<SessionState> {
    const isTurnedOn =
      action === 'TOGGLE_LEADERBOARD' && session.progress.isLeaderboardVisible;
    if (!isTurnedOn) return session;

    const leaderboard = await this.standingsService.leaderboard(
      session.seededGame.gameSessionId,
    );
    return withLeaderboard(session, leaderboard);
  }

  /** Crossing into a showdown's final reveal step records the winner and refreshes the leaderboard it moves. */
  private async resolveShowdownIfFinished(
    step: Extract<MoveStep, { kind: 'showdown_step' }>,
  ): Promise<SessionState> {
    const { session, shouldResolve } = step;
    if (!shouldResolve || !session.activeShowdownRound) return session;
    const { winnerTeamId, isTie } = await this.showdownService.resolve(
      session.activeShowdownRound.id,
    );
    const resolvedRound: ActiveShowdownRoundState = {
      ...session.activeShowdownRound,
      winnerTeamId,
      isTie,
      resolved: true,
    };
    const leaderboard = await this.standingsService.leaderboard(
      session.seededGame.gameSessionId,
    );
    return { ...session, activeShowdownRound: resolvedRound, leaderboard };
  }
}

function toPersistedProgress(session: SessionState): PersistedGameProgress {
  return {
    progress: session.progress,
    livePhaseKey: session.livePhaseKey,
    phaseStartedAt: session.phaseStartedAt,
    phaseElapsedByKey: session.phaseElapsedByKey,
  };
}

function getConnectedTeamIds(session: SessionState): number[] {
  return session.teams
    .filter((team) => Boolean(session.connectedTeamSockets[team.teamId]))
    .map((team) => team.teamId);
}
