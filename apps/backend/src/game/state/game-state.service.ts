import { Injectable, type OnModuleInit } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import {
  DEFAULT_SESSION_SETTINGS,
  getNextGameState,
  type ActiveSessionSummary,
  type AdminQuestionContext,
  type GameAction,
  type LeaderboardEntry,
  type SessionSettings,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import { SeedService } from '@/db/seed.service';
import {
  computeInitialRevealStep,
  tryStepClosestGuessReveal,
} from '@/game/state/closest-guess-reveal.util';
import { GameProgressRepository } from '@/game/state/game-progress.repository';
import { BlockGradingService } from '@/game/state/block-grading.service';
import { GameSessionMutationsService } from '@/game/state/game-session-mutations.service';
import { GameSessionStore } from '@/game/state/game-session.store';
import { computeLeaderboardRevealCount } from '@/game/state/leaderboard-reveal.util';
import { computePhaseTimerFields } from '@/game/state/phase-timer.util';
import {
  buildAdminQuestionContext,
  buildSnapshot,
  isQuestionOpenForAnswering,
} from '@/game/state/session-snapshot.util';
import { SessionCloseBlockedError } from '@/game/state/errors/session-close-blocked.error';
import { SessionSettingsUpdateBlockedError } from '@/game/state/errors/session-settings-update-blocked.error';
import {
  LOBBY_PROGRESS,
  computeQuestionLockAt,
  freshSessionState,
  getGameContext,
  type ActiveShowdownRoundState,
  type SessionState,
} from '@/game/state/session-state';
import { tryStepShowdownReveal } from '@/game/state/showdown-reveal.util';
import { UngradedAnswersError } from '@/game/state/errors/ungraded-answers.error';
import { ShowdownService } from '@/showdown/showdown.service';
import type { TeamRosterEntry } from '@/team/team.service';

export { SessionCloseBlockedError } from '@/game/state/errors/session-close-blocked.error';
export { SessionSettingsUpdateBlockedError } from '@/game/state/errors/session-settings-update-blocked.error';
export { UngradedAnswersError } from '@/game/state/errors/ungraded-answers.error';

@Injectable()
export class GameStateService implements OnModuleInit {
  private readonly sessionStore = new GameSessionStore();
  private readonly mutations = new GameSessionMutationsService(
    this.sessionStore,
  );
  private readonly grading: BlockGradingService;

  constructor(
    private readonly seedService: SeedService,
    private readonly progressRepository: GameProgressRepository,
    private readonly orm: MikroORM,
    private readonly answerService: AnswerService,
    private readonly showdownService: ShowdownService,
  ) {
    this.grading = new BlockGradingService(this.answerService);
  }

  // onModuleInit runs at bootstrap, before any HTTP/socket request has
  // entered the app, so there is no per-request MikroORM context yet for
  // the injected repositories to use — @CreateRequestContext() forks one.
  @CreateRequestContext()
  async onModuleInit(): Promise<void> {
    const seededGame = await this.seedService.seed();
    const savedProgress = await this.progressRepository.load(
      seededGame.gameSessionId,
    );
    const session = freshSessionState(
      seededGame,
      savedProgress ?? { ...LOBBY_PROGRESS },
    );
    this.sessionStore.set(seededGame.joinCode, session);
    this.sessionStore.markInitialized();
  }

  /** Whether a session exists for this joinCode — lets the gateway reject a handshake's `?code=` before trusting it. */
  hasSession(joinCode: string): boolean {
    return this.sessionStore.has(joinCode);
  }

  getGameSessionId(joinCode: string): number {
    return this.sessionStore.get(joinCode).seededGame.gameSessionId;
  }

  getActiveQuizId(joinCode: string): number {
    return this.sessionStore.get(joinCode).seededGame.quizId;
  }

  /** Every currently-running session, for the admin session picker (`GET /sessions`). Titles are filled in by the caller — this service only knows quizId, not quiz metadata. */
  listSessions(): Omit<ActiveSessionSummary, 'quizTitle'>[] {
    return this.sessionStore.values().map((session) => ({
      joinCode: session.seededGame.joinCode,
      quizId: session.seededGame.quizId,
      status: session.progress.status,
      teamCount: session.teams.length,
    }));
  }

  /**
   * Evicts a session's in-memory state once it's done — the eviction policy
   * decided for phase 4: explicit admin action rather than an idle-timeout
   * sweep, since it's deterministic and needs no background timer. Only
   * allowed once the quiz has `ended` — closing a live game would strand any
   * still-connected display/players.
   */
  closeSession(joinCode: string): void {
    const session = this.sessionStore.get(joinCode);
    if (session.progress.status !== 'ended') {
      throw new SessionCloseBlockedError(
        joinCode,
        `still in progress (status: "${session.progress.status}")`,
      );
    }
    this.sessionStore.delete(joinCode);
  }

  /**
   * Allocates a brand-new GameSession/joinCode for `quizId`, leaving any
   * other session's state untouched. Not blocked by another session's
   * progress — `POST /sessions` lets an admin start additional concurrent
   * games regardless of how far along any other session is.
   */
  async createSession(
    quizId: number,
    settings: SessionSettings = DEFAULT_SESSION_SETTINGS,
  ): Promise<StateSnapshotPayload> {
    const created = await this.seedService.createSession(quizId, settings);
    const seededGame = await this.seedService.loadGame(
      quizId,
      created.gameSessionId,
      created.joinCode,
    );
    // The fresh game_sessions row already starts in lobby state, so there is
    // no progress to persist here.
    const session = freshSessionState(seededGame, { ...LOBBY_PROGRESS });
    this.sessionStore.set(seededGame.joinCode, session);
    return this.getSnapshot(seededGame.joinCode);
  }

  /**
   * Re-reads the active quiz's rounds from the database, keeping the
   * session, join code and progress — used after a re-import updates the
   * active quiz's questions in place.
   */
  async reloadActiveQuiz(joinCode: string): Promise<void> {
    const session = this.sessionStore.get(joinCode);
    const { quizId, gameSessionId } = session.seededGame;
    const seededGame = await this.seedService.loadGame(
      quizId,
      gameSessionId,
      joinCode,
    );
    this.sessionStore.set(joinCode, { ...session, seededGame });
  }

  setLeaderboard(joinCode: string, leaderboard: LeaderboardEntry[]): void {
    this.mutations.setLeaderboard(joinCode, leaderboard);
  }

  setTeams(joinCode: string, teams: TeamRosterEntry[]): void {
    this.mutations.setTeams(joinCode, teams);
  }

  getConnectedSocketId(joinCode: string, teamId: number): string | undefined {
    return this.mutations.getConnectedSocketId(joinCode, teamId);
  }

  setTeamConnected(joinCode: string, teamId: number, socketId: string): void {
    this.mutations.setTeamConnected(joinCode, teamId, socketId);
  }

  /** Called on socket disconnect; returns the teamId that was cleared, if any. */
  clearTeamConnectionBySocketId(
    joinCode: string,
    socketId: string,
  ): number | null {
    return this.mutations.clearTeamConnectionBySocketId(joinCode, socketId);
  }

  setAnsweredTeamIds(
    joinCode: string,
    questionId: number,
    teamIds: number[],
  ): void {
    this.mutations.setAnsweredTeamIds(joinCode, questionId, teamIds);
  }

  isQuestionOpenForAnswering(joinCode: string, questionId: number): boolean {
    return isQuestionOpenForAnswering(
      this.sessionStore.get(joinCode),
      questionId,
    );
  }

  getSnapshot(joinCode: string): StateSnapshotPayload {
    return buildSnapshot(this.sessionStore.get(joinCode));
  }

  /** Epoch-ms deadline for auto-locking the current question, or null when none is armed. */
  getQuestionLockAt(joinCode: string): number | null {
    return this.sessionStore.get(joinCode).questionLockAt;
  }

  /** Admin-set/clear the epoch-ms time the break is expected to end — see StateSnapshotPayload.breakEndsAt. */
  setBreakEndTime(joinCode: string, breakEndsAt: number | null): void {
    this.mutations.setBreakEndTime(joinCode, breakEndsAt);
  }

  /** The in-progress/just-resolved showdown round, or null between rounds. */
  getActiveShowdownRound(joinCode: string): ActiveShowdownRoundState | null {
    return this.sessionStore.get(joinCode).activeShowdownRound;
  }

  /** Current showdown reveal sub-step — meaningless while getActiveShowdownRound is null. */
  getShowdownRevealStep(joinCode: string): number {
    return this.sessionStore.get(joinCode).showdownRevealStep;
  }

  setActiveShowdownRound(
    joinCode: string,
    round: ActiveShowdownRoundState,
  ): void {
    this.mutations.setActiveShowdownRound(joinCode, round);
  }

  setShowdownGuess(joinCode: string, teamId: number, value: string): void {
    this.mutations.setShowdownGuess(joinCode, teamId, value);
  }

  /** In-memory-only override of the leaderboard-visible flag — see GameSessionMutationsService.setLeaderboardVisible. */
  setLeaderboardVisible(joinCode: string, isVisible: boolean): void {
    this.mutations.setLeaderboardVisible(joinCode, isVisible);
  }

  /** This session's current settings — used by the gateway to filter enabled bonus categories. */
  getSessionSettings(joinCode: string): SessionSettings {
    return this.sessionStore.get(joinCode).seededGame.settings;
  }

  /**
   * Merges `partial` over the session's current settings, lobby-only — the
   * admin can keep adjusting settings freely up until START_QUIZ, at which
   * point the values in effect must stop moving under the game.
   */
  async updateSessionSettings(
    joinCode: string,
    partial: Partial<SessionSettings>,
  ): Promise<void> {
    const session = this.sessionStore.get(joinCode);
    if (session.progress.status !== 'lobby') {
      throw new SessionSettingsUpdateBlockedError(
        joinCode,
        `already started (status: "${session.progress.status}")`,
      );
    }
    const settings = { ...session.seededGame.settings, ...partial };
    await this.seedService.updateSettings(
      session.seededGame.gameSessionId,
      settings,
    );
    this.sessionStore.set(joinCode, {
      ...session,
      seededGame: { ...session.seededGame, settings },
    });
  }

  async applyAction(
    joinCode: string,
    action: GameAction,
  ): Promise<StateSnapshotPayload> {
    const session = this.sessionStore.get(joinCode);

    // Mid-showdown-reveal intercept — checked first, ahead of the normal
    // status switch below. Gated on status === 'ended' rather than just
    // activeShowdownRound !== null: the admin can compose/save the
    // tiebreaker question as soon as the final block is graded, well before
    // the quiz reaches 'ended' (see ShowdownPanel), so an active round can
    // exist while the block's own answers still haven't been revealed.
    // Without this guard, ADVANCE/PREVIOUS would hijack into the showdown
    // reveal walk immediately and the audience would never see the final
    // round's answers revealed. Once status genuinely is 'ended', it never
    // reaches getNextGameState; status stays 'ended' throughout, nothing
    // persisted.
    if (
      (action === 'ADVANCE' || action === 'PREVIOUS') &&
      session.activeShowdownRound !== null &&
      session.progress.status === 'ended'
    ) {
      const stepped = tryStepShowdownReveal(session, action);
      if (stepped) {
        let updated = stepped.session;
        if (stepped.shouldResolve && updated.activeShowdownRound) {
          const { winnerTeamId, isTie } = await this.showdownService.resolve(
            updated.activeShowdownRound.id,
          );
          const resolvedRound: ActiveShowdownRoundState = {
            ...updated.activeShowdownRound,
            winnerTeamId,
            isTie,
            resolved: true,
          };
          const leaderboard = await this.answerService.computeLeaderboard(
            updated.seededGame.gameSessionId,
          );
          updated = {
            ...updated,
            activeShowdownRound: resolvedRound,
            leaderboard,
          };
        }
        this.sessionStore.set(joinCode, updated);
        return this.getSnapshot(joinCode);
      }
    }

    // Mid-reveal-sequence intercept for closest_guess questions — never
    // reaches getNextGameState, GameProgress untouched, nothing persisted.
    // See tryStepClosestGuessReveal for why this stays entirely ephemeral.
    if (
      (action === 'ADVANCE' || action === 'PREVIOUS') &&
      session.progress.status === 'reveal'
    ) {
      const stepped = tryStepClosestGuessReveal(session, action);
      if (stepped) {
        this.sessionStore.set(joinCode, stepped);
        return this.getSnapshot(joinCode);
      }
    }

    const progress = getNextGameState(
      session.progress,
      action,
      getGameContext(session),
    );

    // Committing out of the break/grading screens into reveal — the one
    // moment this must be DB-authoritative rather than relying on the
    // (possibly stale, e.g. post-restart) ungradedQuestionIds cache below.
    if (
      action === 'ADVANCE' &&
      (session.progress.status === 'break_intro' ||
        session.progress.status === 'break') &&
      progress.status === 'reveal_intro'
    ) {
      const ungradedQuestionIds =
        await this.grading.getUngradedBlockQuestionIds(session);
      if (ungradedQuestionIds.length > 0) {
        throw new UngradedAnswersError(ungradedQuestionIds);
      }
    }

    const gradedSession = await this.grading.ensureBlockGraded(
      session,
      progress,
    );
    const sessionWithGradingStatus =
      await this.grading.refreshUngradedQuestionIds(gradedSession, progress);
    const closestGuessRevealStep = computeInitialRevealStep(
      sessionWithGradingStatus,
      progress,
      action,
    );
    const { livePhaseKey, phaseStartedAt, phaseElapsedByKey } =
      computePhaseTimerFields(
        progress,
        getGameContext(session),
        session.livePhaseKey,
        session.phaseStartedAt,
        session.phaseElapsedByKey,
      );
    const updated: SessionState = {
      ...sessionWithGradingStatus,
      progress,
      livePhaseKey,
      phaseStartedAt,
      phaseElapsedByKey,
      questionLockAt: computeQuestionLockAt(
        progress,
        sessionWithGradingStatus.seededGame.settings.lockGraceSeconds * 1000,
      ),
      // A fresh break starting (the only path into 'break_intro') clears a
      // *stale* end-time left over from a previous break, so the display
      // never shows a past time. It does NOT clear one the admin set in
      // advance while still on the block's last question (BreakEndTimeControl
      // now allows this) — that value is still in the future, so it's kept.
      // Navigating within the same break (break_intro/break/break_round_intro)
      // via Previous/Advance always leaves it untouched regardless.
      breakEndsAt:
        session.progress.status === 'locking' &&
        progress.status === 'break_intro' &&
        sessionWithGradingStatus.breakEndsAt !== null &&
        sessionWithGradingStatus.breakEndsAt <= Date.now()
          ? null
          : sessionWithGradingStatus.breakEndsAt,
      leaderboardRevealCount: computeLeaderboardRevealCount(
        action,
        session.progress.isLeaderboardVisible,
        progress,
        sessionWithGradingStatus.leaderboard,
        sessionWithGradingStatus.leaderboardRevealCount,
      ),
      closestGuessRevealStep,
    };
    this.sessionStore.set(joinCode, updated);
    await this.progressRepository.save(
      updated.seededGame.gameSessionId,
      progress,
    );
    return this.getSnapshot(joinCode);
  }

  /** Incrementally patches the ungraded-question cache for one questionId — called by the gateway right after SUBMIT_ANSWER/GRADE_ANSWER, which grade individual answers without going through applyAction's bulk refresh. */
  setQuestionGradedStatus(
    joinCode: string,
    questionId: number,
    hasUngradedAnswers: boolean,
  ): void {
    this.mutations.setQuestionGradedStatus(
      joinCode,
      questionId,
      hasUngradedAnswers,
    );
  }

  /**
   * Correct answer + round position for a question, for the admin grading
   * view alone. Callers MUST only forward this over an admin-room-only
   * channel (ANSWERS_UPDATED) — never through the broadcast snapshot.
   */
  getAdminQuestionContext(
    joinCode: string,
    questionId: number,
  ): AdminQuestionContext | null {
    const rounds = this.sessionStore.get(joinCode).seededGame.rounds;
    return buildAdminQuestionContext(rounds, questionId);
  }
}
