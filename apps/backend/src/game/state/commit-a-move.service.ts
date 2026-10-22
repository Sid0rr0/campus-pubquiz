import {
  type ActiveShowdownRoundState,
  type GameAction,
  type GameProgress,
  type LeagueTop,
  type MoveStep,
  planMove,
  type ProgressMoveStep,
  type SavedPhaseTimer,
  type SessionState,
  settleMove,
  settleSession,
  ShowdownGuessesPendingError,
} from '@campus-pubquiz/types';
import { BlockGradingService } from '@/game/state/block-grading.service';
import type {
  GameProgressRepository,
  PersistedGameProgress,
} from '@/game/state/game-progress.repository';
import {
  BROADCAST_STATE_OUTCOME,
  connectedTeamSyncs,
  isRevealEntry,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import type { LiveResultsRead } from '@/game/state/live-results-read';
import type { ShowdownService } from '@/showdown/showdown.service';

/** What a restart restores besides the progress: the phase timer and the opened questions (null for a session saved before they were tracked). */
export type SavedPlacement = SavedPhaseTimer & {
  openedQuestionIds: number[] | null;
};

/** A press carried out: the session as it now stands, and what must be pushed because of it. */
export interface CommittedMove {
  session: SessionState;
  outcome: SessionOutcome;
}

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
    private readonly liveResultsRead: LiveResultsRead,
    private readonly showdownService: ShowdownService,
    private readonly readLeagueTop: (
      gameSessionId: number,
    ) => Promise<LeagueTop | null>,
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

    // The ephemeral steps (the stepped reveals' sub-steps) never
    // reach getNextGameState: GameProgress is untouched and nothing is
    // persisted. The Stepped reveal module owns them.
    switch (step.kind) {
      case 'blocked':
        throw step.cause;
      case 'showdown_waiting':
        throw new ShowdownGuessesPendingError();
      case 'reveal_step':
        return {
          session: await this.resolveShowdownIfFinished(step),
          outcome: BROADCAST_STATE_OUTCOME,
        };
      case 'transition':
      case 'grading_pending':
      case 'leaderboard_reveal':
      case 'leaderboard_hide':
      case 'join_overlay_hide':
        return this.commitProgressMove(session, action, step);
    }
  }

  /**
   * Places a session at a starting point — the lobby for a new session, the
   * saved progress and phase timer for a restart restore. Rebuilds the
   * closest_guess summaries and refreshes the ungraded set inside the break,
   * settles and ends with the live results read (the same last step a session
   * write takes, with the same fallback: a failed read keeps the empty value),
   * then the league top, so the first snapshot a client receives already has
   * its live results and league. Nothing is saved.
   */
  async place(
    session: SessionState,
    progress: GameProgress,
    saved?: SavedPlacement,
  ): Promise<SessionState> {
    // The ungraded cache and the closest_guess summaries live in memory
    // only; they must be rebuilt so /control, showdown eligibility and a
    // closest_guess reveal walk are right straight away.
    const refreshed = await this.grading.gradeForPlacement(session, progress);
    // A saved phase timer is restored exactly (unlike the auto-lock
    // deadline's deliberate re-arm-fresh) — its epoch-ms start time is real
    // and persisted, so the elapsed time it shows after a restart is still
    // accurate, downtime included.
    // A session saved before opened questions were tracked has none stored;
    // settle then derives them from the position it is restored to.
    const placed = settleSession({
      session: {
        ...refreshed,
        openedQuestionIds: saved?.openedQuestionIds ?? [],
      },
      progress,
      step: { kind: 'place' },
      now: Date.now(),
      savedPhaseTimer: saved,
    });
    const withResults = await this.liveResultsRead.read(placed);
    // The league top is not a live result (see LiveResultsRead): placement
    // asks the league change module for it by name.
    const leagueTop = await this.readLeagueTop(placed.seededGame.gameSessionId);
    return { ...withResults, leagueTop };
  }

  private async commitProgressMove(
    session: SessionState,
    pressed: GameAction,
    step: ProgressMoveStep,
  ): Promise<CommittedMove> {
    const { progress } = step;

    const { session: refreshed, staleAnswerListIds } =
      await this.grading.gradeForMove(session, progress);
    // settleMove carries a raw ADVANCE under the leaderboard out as the action
    // it plans — ADVANCE for a rank reveal, TOGGLE_LEADERBOARD to hide — so the
    // reveal count, the kahoot timer and everything else downstream treat it
    // identically.
    const committed = settleMove(refreshed, step, pressed, Date.now());

    await this.progressRepository.save(
      committed.seededGame.gameSessionId,
      toPersistedProgress(committed),
    );
    return {
      session: committed,
      outcome: {
        ...BROADCAST_STATE_OUTCOME,
        // The batch just graded these: /control's answer list for them still
        // shows the ungraded rows it was sent while they were open.
        answerListQuestionIds: staleAnswerListIds,
        teamSyncs: isRevealEntry(session.progress.status, progress.status)
          ? connectedTeamSyncs(
              committed,
              committed.teams.map((team) => team.teamId),
            )
          : [],
      },
    };
  }

  /** Crossing into a showdown's final reveal step records the winner; the session write's standings read then puts its bonus on the leaderboard. */
  private async resolveShowdownIfFinished(
    step: Extract<MoveStep, { kind: 'reveal_step' }>,
  ): Promise<SessionState> {
    const { session, reveal, isFinal } = step;
    if (reveal !== 'showdown' || !isFinal || !session.activeShowdownRound) {
      return session;
    }
    const { winnerTeamId, isTie } = await this.showdownService.resolve(
      session.activeShowdownRound.id,
    );
    const resolvedRound: ActiveShowdownRoundState = {
      ...session.activeShowdownRound,
      winnerTeamId,
      isTie,
      resolved: true,
    };
    return { ...session, activeShowdownRound: resolvedRound };
  }
}

function toPersistedProgress(session: SessionState): PersistedGameProgress {
  return {
    progress: session.progress,
    livePhaseKey: session.livePhaseKey,
    phaseStartedAt: session.phaseStartedAt,
    phaseElapsedByKey: session.phaseElapsedByKey,
    openedQuestionIds: session.openedQuestionIds,
  };
}
