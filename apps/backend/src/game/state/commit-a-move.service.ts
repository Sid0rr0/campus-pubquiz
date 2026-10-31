import {
  type ActiveShowdownRoundState,
  type GameAction,
  type LeagueTop,
  LOBBY_PROGRESS,
  type MoveStep,
  planMove,
  type ProgressMoveStep,
  type SessionState,
  settleMove,
  settleSession,
  ShowdownGuessesPendingError,
} from '@campus-pubquiz/types';
import type { CarriedCoinService } from '@/coins/carried-coin.service';
import { BlockGradingService } from '@/game/state/block-grading.service';
import type {
  GameProgressRepository,
  PersistedGameProgress,
} from '@/game/state/game-progress.repository';
import {
  BROADCAST_STATE_OUTCOME,
  coinSyncsFor,
  connectedTeamSyncs,
  isRevealEntry,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import type { ClosedJokerPick, JokerChanges } from '@/game/state/joker-changes';
import type { LiveResultsRead } from '@/game/state/live-results-read';
import type { ShowdownService } from '@/showdown/showdown.service';

/** A press carried out: the session as it now stands, and what must be pushed because of it. */
export interface CommittedMove {
  session: SessionState;
  outcome: SessionOutcome;
  /** Always true: a press can grade at the lock, so its standings are always re-read. */
  touchedScores: true;
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
    private readonly jokers: Pick<
      JokerChanges,
      'closePick' | 'reopenPick' | 'loadAll'
    >,
    private readonly carriedCoins: Pick<
      CarriedCoinService,
      'decide' | 'loadAll'
    >,
    private readonly readCoinAwards: (
      gameSessionId: number,
    ) => Promise<Record<number, number>>,
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
          touchedScores: true,
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
    saved: PersistedGameProgress | null,
  ): Promise<SessionState> {
    const progress = saved?.progress ?? { ...LOBBY_PROGRESS };
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
        revealedKahootQuestionIds: saved?.revealedKahootQuestionIds ?? [],
      },
      progress,
      step: { kind: 'place' },
      now: Date.now(),
      savedPhaseTimer: saved ?? undefined,
    });
    const withResults = await this.liveResultsRead.read(placed);
    // The league top is not a live result (see LiveResultsRead): placement
    // asks the league change module for it by name.
    const leagueTop = await this.readLeagueTop(placed.seededGame.gameSessionId);
    // Jokers are stored, not derived: the placed session starts from them.
    const jokers = await this.jokers.loadAll(placed.seededGame.gameSessionId);
    const carriedCoins = await this.carriedCoins.loadAll(
      placed.seededGame.gameSessionId,
    );
    // Coin awards are stored too: the cache starts from them.
    const coinAwards = await this.readCoinAwards(
      placed.seededGame.gameSessionId,
    );
    return { ...withResults, leagueTop, jokers, carriedCoins, coinAwards };
  }

  private async commitProgressMove(
    session: SessionState,
    pressed: GameAction,
    step: ProgressMoveStep,
  ): Promise<CommittedMove> {
    const { progress } = step;

    // Leaving the joker pick by any route closes it: teams without a joker
    // are given a drawn one before the quiz moves on. Entering it (again)
    // reopens it: drawn jokers are cleared so those teams can really choose.
    const wasPicking = session.progress.status === 'joker_pick';
    const isPicking = progress.status === 'joker_pick';
    let closedPick: ClosedJokerPick | null = null;
    if (wasPicking && !isPicking) {
      closedPick = await this.jokers.closePick(session);
    } else if (!wasPicking && isPicking) {
      closedPick = await this.jokers.reopenPick(session);
    }

    // Leaving the lobby decides every rostered team's carried coin, once.
    const base = closedPick?.session ?? session;
    const isLeavingLobby =
      session.progress.status === 'lobby' && progress.status !== 'lobby';
    const started = isLeavingLobby
      ? {
          ...base,
          carriedCoins: await this.carriedCoins.decide(
            base.seededGame.gameSessionId,
            base.teams.map((team) => team.teamId),
          ),
        }
      : base;

    const { session: refreshed, staleAnswerListIds } =
      await this.grading.gradeForMove(started, progress);
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
        jokerSyncs: closedPick?.jokerSyncs ?? [],
        // A phone joined in the lobby knows its coins from before they were decided.
        coinSyncs: isLeavingLobby ? coinSyncsFor(committed) : [],
      },
      touchedScores: true,
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
    revealedKahootQuestionIds: session.revealedKahootQuestionIds,
  };
}
