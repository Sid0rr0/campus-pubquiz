import { Injectable, type OnModuleInit } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import {
  DEFAULT_SESSION_SETTINGS,
  SOCKET_EVENTS,
  getNextGameState,
  type ActiveSessionSummary,
  type AdminQuestionContext,
  type GameAction,
  type PresenterContextPayload,
  type SessionSettings,
  type StateSnapshotPayload,
  type TeamBonusAwardView,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import { SeedService } from '@/db/seed.service';
import {
  getBlockSeededQuestions,
  getPastRevealedQuestions,
} from '@/game/state/block-questions.util';
import {
  computeInitialRevealStep,
  tryStepClosestGuessReveal,
} from '@/game/state/closest-guess-reveal.util';
import { GameProgressRepository } from '@/game/state/game-progress.repository';
import {
  BlockGradingService,
  canBeUngraded,
} from '@/game/state/block-grading.service';
import { GameSessionStore } from '@/game/state/game-session.store';
import { computeLeaderboardRevealCount } from '@/game/state/leaderboard-reveal.util';
import { computePhaseTimerFields } from '@/game/state/phase-timer.util';
import {
  buildAdminQuestionContext,
  buildPresenterContext,
  buildSnapshot,
  isQuestionOpenForAnswering,
} from '@/game/state/session-snapshot.util';
import { SessionCloseBlockedError } from '@/game/state/errors/session-close-blocked.error';
import { SessionSettingsUpdateBlockedError } from '@/game/state/errors/session-settings-update-blocked.error';
import {
  LOBBY_PROGRESS,
  computeKahootQuestionEndsAt,
  computeQuestionLockAt,
  freshSessionState,
  getGameContext,
  type ActiveShowdownRoundState,
  type SessionState,
} from '@/game/state/session-state';
import {
  findTeamIdBySocketId,
  withActiveShowdownRound,
  withAnsweredTeamIds,
  withBreakEndTime,
  withDisplayTextScale,
  withLeaderboard,
  withQuestionGradedStatus,
  withShowdownGuess,
  withTeamConnected,
  withTeams,
  withoutTeamConnection,
} from '@/game/state/session-updates.util';
import {
  BROADCAST_STATE_OUTCOME,
  isRevealEntry,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import { tryStepShowdownReveal } from '@/game/state/showdown-reveal.util';
import { UngradedAnswersError } from '@/game/state/errors/ungraded-answers.error';
import { ShowdownService } from '@/showdown/showdown.service';
import type { TeamRosterEntry } from '@/team/team.service';

export { SessionCloseBlockedError } from '@/game/state/errors/session-close-blocked.error';
export { SessionSettingsUpdateBlockedError } from '@/game/state/errors/session-settings-update-blocked.error';

@Injectable()
export class GameStateService implements OnModuleInit {
  private readonly sessionStore = new GameSessionStore();
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
    const saved = await this.progressRepository.load(seededGame.gameSessionId);
    const session = freshSessionState(
      seededGame,
      saved?.progress ?? { ...LOBBY_PROGRESS },
    );
    this.sessionStore.set(
      seededGame.joinCode,
      // A saved phase timer is restored exactly (unlike questionLockAt's
      // deliberate re-arm-fresh below) — its epoch-ms start time is real and
      // persisted, so the elapsed time it shows after a restart is still
      // accurate, downtime included.
      saved
        ? {
            ...session,
            livePhaseKey: saved.livePhaseKey,
            phaseStartedAt: saved.phaseStartedAt,
            phaseElapsedByKey: saved.phaseElapsedByKey,
            // freshSessionState above already computed kahootQuestionEndsAt
            // from a throwaway Date.now()-based livePhaseKey/phaseStartedAt
            // guess — recompute it against the final saved fields, or a
            // restart mid-kahoot-question would arm the wrong deadline.
            kahootQuestionEndsAt: computeKahootQuestionEndsAt(
              session.progress,
              getGameContext(session),
              session.seededGame.settings.kahootQuestionTimerSeconds,
              saved.livePhaseKey,
              saved.phaseStartedAt,
            ),
          }
        : session,
    );
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

  /** Every currently-running session, for the admin session picker (`GET /sessions`). Titles, names, and start times are filled in by the caller — this service only knows quizId, not quiz/GameSession metadata. */
  listSessions(): Omit<
    ActiveSessionSummary,
    'quizTitle' | 'name' | 'startedAt'
  >[] {
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
    name?: string,
  ): Promise<StateSnapshotPayload> {
    const created = await this.seedService.createSession(
      quizId,
      settings,
      name,
    );
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

  /**
   * Re-grades already-shown questions whose answer/points were corrected by
   * a live edit — call after reloadActiveQuiz, so the corrected key is what
   * gets graded against. See BlockGradingService.regradeQuestions. Returns
   * the ids of the questions it actually re-scored.
   */
  async regradeQuestions(
    joinCode: string,
    questionIds: readonly number[],
  ): Promise<readonly number[]> {
    const session = this.sessionStore.get(joinCode);
    const { session: regraded, regradedQuestionIds } =
      await this.grading.regradeQuestions(session, questionIds);
    this.sessionStore.set(joinCode, regraded);
    return regradedQuestionIds;
  }

  /**
   * The quiz behind a live session was edited in place: reloads its
   * questions and re-grades `regradeQuestionIds` (already-shown questions
   * whose answer/points were corrected). The outcome names every re-scored
   * question for a fresh admin answer list, and every connected team with an
   * answer to one for a per-team sync — so the grading panel, the big screen
   * and the phones all show the corrected points.
   */
  async quizEdited(
    joinCode: string,
    regradeQuestionIds: readonly number[] = [],
  ): Promise<SessionOutcome> {
    await this.reloadActiveQuiz(joinCode);
    const regradedQuestionIds =
      regradeQuestionIds.length > 0
        ? await this.regradeQuestions(joinCode, regradeQuestionIds)
        : [];
    if (regradedQuestionIds.length === 0) return BROADCAST_STATE_OUTCOME;

    const gameSessionId = this.getGameSessionId(joinCode);
    const answerLists = await Promise.all(
      regradedQuestionIds.map((questionId) =>
        this.answerService.listForQuestion(gameSessionId, questionId),
      ),
    );
    const answeredTeamIds = new Set(
      answerLists.flat().map((answer) => answer.teamId),
    );
    const teamSyncTeamIds = this.getSnapshot(joinCode)
      .teams.filter(
        (team) => team.isConnected && answeredTeamIds.has(team.teamId),
      )
      .map((team) => team.teamId);
    return {
      ...BROADCAST_STATE_OUTCOME,
      answerListQuestionIds: regradedQuestionIds,
      teamSyncTeamIds,
    };
  }

  /**
   * Question ids already shown or currently in progress in this session —
   * every past block's questions plus the current block's furthest-opened
   * position, the exact "already shown" boundary `BlockGradingService`
   * already relies on. Used to lock those questions against live editing
   * (`QuizController.update`); everything strictly ahead stays editable.
   */
  getShownOrInProgressQuestionIds(joinCode: string): number[] {
    const session = this.sessionStore.get(joinCode);
    return [
      ...getPastRevealedQuestions(session),
      ...getBlockSeededQuestions(session),
    ].map((question) => question.id);
  }

  /** The socket currently connected for `teamId`, if any. */
  getConnectedSocketId(joinCode: string, teamId: number): string | undefined {
    return this.sessionStore.get(joinCode).connectedTeamSockets[teamId];
  }

  /**
   * A team's socket joined: records its connection and the session's roster
   * (which now includes the team) together, so the next snapshot shows the
   * team as connected.
   */
  teamConnected(
    joinCode: string,
    teamId: number,
    socketId: string,
    roster: TeamRosterEntry[],
  ): SessionOutcome {
    this.update(joinCode, (session) =>
      withTeams(withTeamConnected(session, teamId, socketId), roster),
    );
    return BROADCAST_STATE_OUTCOME;
  }

  /** A socket dropped: frees its team, if it held one. Null when the socket wasn't a team's — nothing to push. */
  teamDisconnected(joinCode: string, socketId: string): SessionOutcome | null {
    const teamId = findTeamIdBySocketId(
      this.sessionStore.get(joinCode),
      socketId,
    );
    if (teamId === null) return null;
    this.update(joinCode, (session) => withoutTeamConnection(session, teamId));
    return BROADCAST_STATE_OUTCOME;
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

  /** Epoch-ms the currently-live timed phase started — the same value ensureKahootSpeedScored anchors its response-time math to. Null when the current phase (e.g. a non-question status) isn't timed. */
  getPhaseStartedAt(joinCode: string): number | null {
    return this.sessionStore.get(joinCode).phaseStartedAt;
  }

  /** Epoch-ms deadline for auto-locking the currently-open kahootMode question, or null when none is armed. */
  getKahootQuestionEndsAt(joinCode: string): number | null {
    return this.sessionStore.get(joinCode).kahootQuestionEndsAt;
  }

  /** Admin-set/clear the epoch-ms time the break is expected to end — see StateSnapshotPayload.breakEndsAt. */
  breakEndTimeSet(
    joinCode: string,
    breakEndsAt: number | null,
  ): SessionOutcome {
    this.update(joinCode, (session) => withBreakEndTime(session, breakEndsAt));
    return BROADCAST_STATE_OUTCOME;
  }

  /** Admin-set text-size multiplier for every /display screen except the header — see StateSnapshotPayload.displayTextScale. */
  displayTextScaleSet(
    joinCode: string,
    displayTextScale: number,
  ): SessionOutcome {
    this.update(joinCode, (session) =>
      withDisplayTextScale(session, displayTextScale),
    );
    return BROADCAST_STATE_OUTCOME;
  }

  /** The in-progress/just-resolved showdown round, or null between rounds. */
  getActiveShowdownRound(joinCode: string): ActiveShowdownRoundState | null {
    return this.sessionStore.get(joinCode).activeShowdownRound;
  }

  /** Current showdown reveal sub-step — meaningless while getActiveShowdownRound is null. */
  getShowdownRevealStep(joinCode: string): number {
    return this.sessionStore.get(joinCode).showdownRevealStep;
  }

  /** A showdown round was created (or sudden death started a fresh one): caches it and resets the reveal step. */
  showdownRoundCreated(
    joinCode: string,
    round: ActiveShowdownRoundState,
  ): SessionOutcome {
    this.update(joinCode, (session) => withActiveShowdownRound(session, round));
    return BROADCAST_STATE_OUTCOME;
  }

  /** A team's showdown guess was stored: the latest guess replaces any earlier one. */
  showdownGuessSubmitted(
    joinCode: string,
    teamId: number,
    value: string,
  ): SessionOutcome {
    this.update(joinCode, (session) =>
      withShowdownGuess(session, teamId, value),
    );
    return BROADCAST_STATE_OUTCOME;
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

  /**
   * Applies an admin action (or a timer expiry standing in for one) and says
   * what must be pushed. Owns every follow-up an action implies — the fresh
   * leaderboard when it is toggled on, and the per-team answer sync on
   * reveal entry — so the admin path and both timer paths behave the same.
   * Throws whatever applyAction throws (illegal transition, ungraded answers).
   */
  async applyAdminAction(
    joinCode: string,
    action: GameAction,
  ): Promise<SessionOutcome> {
    const previousStatus = this.getSnapshot(joinCode).progress.status;
    const snapshot = await this.applyAction(joinCode, action);

    // Answers and grades refresh the leaderboard, but a team that hasn't
    // answered yet isn't on it — recompute fresh here so every currently-
    // joined team appears, 0 points and all.
    if (
      action === 'TOGGLE_LEADERBOARD' &&
      snapshot.progress.isLeaderboardVisible
    ) {
      const leaderboard = await this.answerService.computeLeaderboard(
        this.getGameSessionId(joinCode),
      );
      this.update(joinCode, (session) => withLeaderboard(session, leaderboard));
    }

    const teamSyncTeamIds = isRevealEntry(
      previousStatus,
      snapshot.progress.status,
    )
      ? this.getSnapshot(joinCode)
          .teams.filter((team) => team.isConnected)
          .map((team) => team.teamId)
      : [];
    return { ...BROADCAST_STATE_OUTCOME, teamSyncTeamIds };
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

    const speedScoredSession = await this.grading.ensureKahootSpeedScored(
      session,
      progress,
    );
    const gradedSession = await this.grading.ensureBlockGraded(
      speedScoredSession,
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
      kahootQuestionEndsAt: computeKahootQuestionEndsAt(
        progress,
        getGameContext(session),
        sessionWithGradingStatus.seededGame.settings.kahootQuestionTimerSeconds,
        livePhaseKey,
        phaseStartedAt,
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
        getGameContext(session).rounds[progress.roundIndex]?.kahootMode ??
          false,
      ),
      closestGuessRevealStep,
    };
    this.sessionStore.set(joinCode, updated);
    await this.progressRepository.save(updated.seededGame.gameSessionId, {
      progress,
      livePhaseKey: updated.livePhaseKey,
      phaseStartedAt: updated.phaseStartedAt,
      phaseElapsedByKey: updated.phaseElapsedByKey,
    });
    return this.getSnapshot(joinCode);
  }

  /**
   * A team's answer to `questionId` was just recorded (and, for auto-graded
   * types, graded): refreshes the leaderboard, the question's answered-team
   * ids and its ungraded flag, and says the admin needs that question's
   * answer list afresh.
   */
  recordAnswer(joinCode: string, questionId: number): Promise<SessionOutcome> {
    return this.refreshAfterAnswerChange(joinCode, questionId);
  }

  /** An admin graded an answer to `questionId`: same refresh as recordAnswer. */
  answerGraded(joinCode: string, questionId: number): Promise<SessionOutcome> {
    return this.refreshAfterAnswerChange(joinCode, questionId);
  }

  /**
   * A team left the session (kicked or left on its own) and `roster` is the
   * session's roster after its removal: drops the team's connection and
   * refreshes roster and leaderboard together, so the next snapshot never
   * has one without the other. A kick also carries TEAM_KICKED for the
   * team's socket, if it still has one.
   */
  async teamRemoved(
    joinCode: string,
    teamId: number,
    roster: TeamRosterEntry[],
    reason: 'kicked' | 'left',
  ): Promise<SessionOutcome> {
    const socketId = this.getConnectedSocketId(joinCode, teamId);
    const leaderboard = await this.answerService.computeLeaderboard(
      this.getGameSessionId(joinCode),
    );
    this.update(joinCode, (session) =>
      withLeaderboard(
        withTeams(withoutTeamConnection(session, teamId), roster),
        leaderboard,
      ),
    );
    const notices =
      reason === 'kicked' && socketId
        ? [{ socketId, event: SOCKET_EVENTS.TEAM_KICKED, payload: undefined }]
        : [];
    return { ...BROADCAST_STATE_OUTCOME, notices };
  }

  /**
   * A bonus award was added, edited or deleted: refreshes the leaderboard the
   * same way grading does. `awarded` (a fresh award only) carries its
   * BONUS_AWARDED notice for that team's socket, if it is connected.
   */
  async bonusChanged(
    joinCode: string,
    awarded?: { teamId: number; notice: TeamBonusAwardView },
  ): Promise<SessionOutcome> {
    const leaderboard = await this.answerService.computeLeaderboard(
      this.getGameSessionId(joinCode),
    );
    this.update(joinCode, (session) => withLeaderboard(session, leaderboard));
    const socketId = awarded
      ? this.getConnectedSocketId(joinCode, awarded.teamId)
      : undefined;
    const notices =
      awarded && socketId
        ? [
            {
              socketId,
              event: SOCKET_EVENTS.BONUS_AWARDED,
              payload: awarded.notice,
            },
          ]
        : [];
    return { ...BROADCAST_STATE_OUTCOME, notices };
  }

  private async refreshAfterAnswerChange(
    joinCode: string,
    questionId: number,
  ): Promise<SessionOutcome> {
    const gameSessionId = this.getGameSessionId(joinCode);
    const [answers, leaderboard] = await Promise.all([
      this.answerService.listForQuestion(gameSessionId, questionId),
      this.answerService.computeLeaderboard(gameSessionId),
    ]);
    const question = this.findQuestion(joinCode, questionId);
    const hasUngradedAnswers =
      question !== undefined &&
      canBeUngraded(question) &&
      answers.some((answer) => answer.gradedAt === null);
    this.update(joinCode, (session) =>
      withQuestionGradedStatus(
        withAnsweredTeamIds(
          withLeaderboard(session, leaderboard),
          questionId,
          answers.map((answer) => answer.teamId),
        ),
        questionId,
        hasUngradedAnswers,
      ),
    );
    return { ...BROADCAST_STATE_OUTCOME, answerListQuestionIds: [questionId] };
  }

  /** Applies a pure update to the session record — the only way this module writes a single field. */
  private update(
    joinCode: string,
    change: (session: SessionState) => SessionState,
  ): void {
    this.sessionStore.set(joinCode, change(this.sessionStore.get(joinCode)));
  }

  private findQuestion(joinCode: string, questionId: number) {
    return this.sessionStore
      .get(joinCode)
      .seededGame.rounds.flatMap((round) => round.questions)
      .find((question) => question.id === questionId);
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

  /**
   * Host notes for the open question + a preview of the next question, for
   * the /remote presenter view alone. Callers MUST only forward this over
   * an admin-room-only channel (PRESENTER_CONTEXT_UPDATED) — never through
   * the broadcast snapshot.
   */
  getPresenterContext(joinCode: string): PresenterContextPayload {
    return buildPresenterContext(this.sessionStore.get(joinCode));
  }
}
