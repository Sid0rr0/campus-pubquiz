import { Injectable, type OnModuleInit } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import {
  DEFAULT_SESSION_SETTINGS,
  SOCKET_EVENTS,
  type ActiveSessionSummary,
  type AdminQuestionContext,
  type GameAction,
  type PresenterContextPayload,
  type ScoredQuestion,
  type SessionSettings,
  type SocketRoomName,
  type StateSnapshotPayload,
  type StateViewByRoom,
  type TeamBonusAwardView,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import { StandingsService } from '@/standings/standings.service';
import { SeedService } from '@/db/seed.service';
import {
  getBlockSeededQuestions,
  getPastRevealedQuestions,
} from '@/game/state/block-questions.util';
import { GameProgressRepository } from '@/game/state/game-progress.repository';
import { BlockGradingService } from '@/game/state/block-grading.service';
import { GameSessionStore } from '@/game/state/game-session.store';
import { SessionWriteQueue } from '@/game/state/session-write-queue';
import { MoveCommitter } from '@/game/state/commit-a-move.service';
import { projectScreen } from '@/game/state/screen-projection.util';
import { buildPresenterContext } from '@/game/state/screen-preview.util';
import {
  buildAdminQuestionContext,
  buildSnapshot,
  isQuestionOpenForAnswering,
} from '@/game/state/session-snapshot.util';
import { SessionCloseBlockedError } from '@/game/state/errors/session-close-blocked.error';
import { SessionSettingsUpdateBlockedError } from '@/game/state/errors/session-settings-update-blocked.error';
import {
  LOBBY_PROGRESS,
  freshSessionState,
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
  withGradingRefresh,
  withShowdownGuess,
  withTeamConnected,
  withTeams,
  withoutTeamConnection,
} from '@/game/state/session-updates.util';
import {
  BROADCAST_STATE_OUTCOME,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import { ShowdownService } from '@/showdown/showdown.service';
import type { TeamRosterEntry } from '@/team/team.service';

export { SessionCloseBlockedError } from '@/game/state/errors/session-close-blocked.error';
export { SessionSettingsUpdateBlockedError } from '@/game/state/errors/session-settings-update-blocked.error';

@Injectable()
export class GameStateService implements OnModuleInit {
  private readonly sessionStore = new GameSessionStore();
  private readonly sessionWrites = new SessionWriteQueue();
  private readonly grading: BlockGradingService;
  private readonly moveCommitter: MoveCommitter;

  constructor(
    private readonly seedService: SeedService,
    private readonly progressRepository: GameProgressRepository,
    private readonly orm: MikroORM,
    private readonly answerService: AnswerService,
    private readonly standingsService: StandingsService,
    private readonly showdownService: ShowdownService,
  ) {
    this.grading = new BlockGradingService(
      this.answerService,
      this.standingsService,
    );
    this.moveCommitter = new MoveCommitter(
      this.grading,
      this.progressRepository,
      this.standingsService,
      this.showdownService,
    );
  }

  // onModuleInit runs at bootstrap, before any HTTP/socket request has
  // entered the app, so there is no per-request MikroORM context yet for
  // the injected repositories to use — @CreateRequestContext() forks one.
  @CreateRequestContext()
  async onModuleInit(): Promise<void> {
    const seededGame = await this.seedService.seed();
    const saved = await this.progressRepository.load(seededGame.gameSessionId);
    const progress = saved?.progress ?? { ...LOBBY_PROGRESS };
    this.sessionStore.set(
      seededGame.joinCode,
      await this.moveCommitter.place(
        freshSessionState(seededGame),
        progress,
        saved ?? undefined,
      ),
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
    this.sessionStore.set(
      seededGame.joinCode,
      await this.moveCommitter.place(freshSessionState(seededGame), {
        ...LOBBY_PROGRESS,
      }),
    );
    return this.getSnapshot(seededGame.joinCode);
  }

  /**
   * Re-reads the active quiz's rounds from the database, keeping the
   * session, join code and progress. Private to quizEdited — an editor save
   * and a re-import both come through it — so a reload always ends in a
   * broadcast.
   */
  private async reloadActiveQuiz(joinCode: string): Promise<void> {
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
   * gets graded against. `previousQuestions` are the edited questions as
   * they were before the reload. Ends through the grading refresh: fetched,
   * then applied in one synchronous update on the session as it is by then,
   * never a read-modify-write of the whole session across an await. Like the
   * answer-change path, the fetched values can be a moment old; a break entry
   * re-reads the whole block. See BlockGradingService.regradeQuestions.
   * Returns the ids of the questions it actually re-scored.
   */
  async regradeQuestions(
    joinCode: string,
    questionIds: readonly number[],
    previousQuestions?: ReadonlyMap<number, ScoredQuestion>,
  ): Promise<readonly number[]> {
    const { regradedQuestionIds, closestGuessSummaries } =
      await this.grading.regradeQuestions(
        this.sessionStore.get(joinCode),
        questionIds,
        previousQuestions,
      );
    if (regradedQuestionIds.length === 0) return regradedQuestionIds;

    const refresh = await this.grading.gradingRefresh(
      this.sessionStore.get(joinCode),
      regradedQuestionIds,
    );
    this.update(joinCode, (session) =>
      withGradingRefresh(
        {
          ...session,
          closestGuessSummaries: {
            ...session.closestGuessSummaries,
            ...closestGuessSummaries,
          },
        },
        refresh,
      ),
    );
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
    const previousQuestions = new Map(
      this.sessionStore
        .get(joinCode)
        .seededGame.rounds.flatMap((round) => round.questions)
        .map((question) => [question.id, question] as const),
    );
    await this.reloadActiveQuiz(joinCode);
    const regradedQuestionIds =
      regradeQuestionIds.length > 0
        ? await this.regradeQuestions(
            joinCode,
            regradeQuestionIds,
            previousQuestions,
          )
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
   * team as connected — and on the leaderboard from the moment it joins,
   * at zero points until it scores.
   */
  async teamConnected(
    joinCode: string,
    teamId: number,
    socketId: string,
    roster: TeamRosterEntry[],
  ): Promise<SessionOutcome> {
    const leaderboard = await this.standingsService.leaderboard(
      this.getGameSessionId(joinCode),
    );
    this.update(joinCode, (session) =>
      withLeaderboard(
        withTeams(withTeamConnected(session, teamId, socketId), roster),
        leaderboard,
      ),
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

  /** The view of the session that one room is sent — see projectScreen. */
  getView<Room extends SocketRoomName>(
    joinCode: string,
    room: Room,
  ): StateViewByRoom[Room] {
    return projectScreen(this.sessionStore.get(joinCode), room);
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
   * what must be pushed. Carries the press out through the Move committer —
   * every follow-up it implies (the fresh leaderboard when it is toggled on,
   * the per-team answer sync on reveal entry) comes back in the outcome — so
   * the admin path and both timer paths behave the same. The session is
   * stored only once its progress is saved, so a refused press leaves it
   * where it was. Throws whatever the commit throws (illegal transition,
   * ungraded answers, a failed save).
   */
  async applyAdminAction(
    joinCode: string,
    action: GameAction,
  ): Promise<SessionOutcome> {
    const { session, outcome } = await this.moveCommitter.commit(
      this.sessionStore.get(joinCode),
      action,
    );
    this.sessionStore.set(joinCode, session);
    return outcome;
  }

  /** The same press as applyAdminAction, answering with the snapshot it leaves behind. */
  async applyAction(
    joinCode: string,
    action: GameAction,
  ): Promise<StateSnapshotPayload> {
    await this.applyAdminAction(joinCode, action);
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
    const leaderboard = await this.standingsService.leaderboard(
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
    return this.writeSession(joinCode, (session) => {
      const socketId = awarded
        ? session.connectedTeamSockets[awarded.teamId]
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
      return Promise.resolve({
        session,
        outcome: { ...BROADCAST_STATE_OUTCOME, notices },
      });
    });
  }

  private async refreshAfterAnswerChange(
    joinCode: string,
    questionId: number,
  ): Promise<SessionOutcome> {
    const [answers, refresh] = await Promise.all([
      this.answerService.listForQuestion(
        this.getGameSessionId(joinCode),
        questionId,
      ),
      this.grading.gradingRefresh(this.sessionStore.get(joinCode), [
        questionId,
      ]),
    ]);
    this.update(joinCode, (session) =>
      withGradingRefresh(
        withAnsweredTeamIds(
          session,
          questionId,
          answers.map((answer) => answer.teamId),
        ),
        refresh,
      ),
    );
    return { ...BROADCAST_STATE_OUTCOME, answerListQuestionIds: [questionId] };
  }

  /**
   * A session write: runs `change` against the session as the previous write
   * for this join code left it, reads standings once as the last step
   * (unless the write says it doesn't change scores), stores the result and
   * returns the change's outcome. A change that throws stores nothing and
   * doesn't hold up the next write. Not re-entrant: `change` must not call
   * another public event method of this module.
   */
  private writeSession<T>(
    joinCode: string,
    change: (
      session: SessionState,
    ) => Promise<{ session: SessionState; outcome: T }>,
    { refreshStandings = true }: { refreshStandings?: boolean } = {},
  ): Promise<T> {
    return this.sessionWrites.run(joinCode, async () => {
      const started = this.sessionStore.get(joinCode);
      const { session, outcome } = await change(started);
      const leaderboard = refreshStandings
        ? await this.standingsService.leaderboard(
            session.seededGame.gameSessionId,
          )
        : undefined;
      // Events that haven't moved onto the session write yet can still store
      // while the standings read is in flight. A change that left the session
      // as it found it must not put its old copy back over them (or over a
      // closed session, which `get` rejects).
      const base =
        session === started ? this.sessionStore.get(joinCode) : session;
      this.sessionStore.set(
        joinCode,
        leaderboard ? withLeaderboard(base, leaderboard) : base,
      );
      return outcome;
    });
  }

  /** Applies a pure update to the session record — the only way this module writes a single field. */
  private update(
    joinCode: string,
    change: (session: SessionState) => SessionState,
  ): void {
    this.sessionStore.set(joinCode, change(this.sessionStore.get(joinCode)));
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
