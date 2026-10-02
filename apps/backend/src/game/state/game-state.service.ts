import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import {
  DEFAULT_SESSION_SETTINGS,
  SOCKET_EVENTS,
  type ActiveSessionSummary,
  type AdminQuestionContext,
  type GameAction,
  type LeaderboardEntry,
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
import { getFeedbackField } from '@/game/state/feedback-rounds.util';
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

/** Reads the session's current roster from the database — run inside a session write, so it sees every removal and join that ran before it. */
export type RosterLoader = () => Promise<TeamRosterEntry[]>;

export { SessionCloseBlockedError } from '@/game/state/errors/session-close-blocked.error';
export { SessionSettingsUpdateBlockedError } from '@/game/state/errors/session-settings-update-blocked.error';

/** The option for a session write whose event doesn't change scores: skips the standings read. */
const NOT_TOUCHING_SCORES = { refreshStandings: false } as const;

@Injectable()
export class GameStateService implements OnModuleInit {
  // A string, not `GameStateService.name`: `nest build` crashes with
  // "reading 'checkJsDirective'" on that self-reference in this file.
  private readonly logger = new Logger('GameStateService');
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
    this.grading = new BlockGradingService(this.answerService);
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
   * Resolves once every session write queued for `joinCode` has finished.
   * Only observes the queue; lets a test assert after in-flight writes land.
   */
  whenSessionWritesIdle(joinCode: string): Promise<void> {
    return this.sessionWrites.idle(joinCode);
  }

  /**
   * Evicts a session's in-memory state once it's done — the eviction policy
   * decided for phase 4: explicit admin action rather than an idle-timeout
   * sweep, since it's deterministic and needs no background timer. Only
   * allowed once the quiz has `ended` — closing a live game would strand any
   * still-connected display/players. A write queued behind the close fails
   * with the unknown-session error.
   */
  closeSession(joinCode: string): Promise<void> {
    // On the queue like a session write, but it deletes the session rather
    // than storing one — so a write still in progress can't put it back, and
    // one queued behind it finds no session.
    return this.sessionWrites.run(joinCode, () => {
      const session = this.sessionStore.get(joinCode);
      if (session.progress.status !== 'ended') {
        throw new SessionCloseBlockedError(
          joinCode,
          `still in progress (status: "${session.progress.status}")`,
        );
      }
      this.sessionStore.delete(joinCode);
      return Promise.resolve();
    });
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
   * session, join code and progress. A step of quizEdited, so it takes and
   * returns a session value and never queues.
   */
  private async withReloadedQuiz(session: SessionState): Promise<SessionState> {
    const { quizId, gameSessionId, joinCode } = session.seededGame;
    const seededGame = await this.seedService.loadGame(
      quizId,
      gameSessionId,
      joinCode,
    );
    return { ...session, seededGame };
  }

  /**
   * Re-grades already-shown questions whose answer/points were corrected by
   * a live edit — a step of quizEdited, run on the session after
   * withReloadedQuiz so the corrected key is what gets graded against.
   * `previousQuestions` are the edited questions as they were before the
   * reload. Ends through the grading refresh. Returns the session with the
   * re-scored questions refreshed, and the ids of the questions it actually
   * re-scored. See BlockGradingService.regradeQuestions.
   */
  private async withRegradedQuestions(
    session: SessionState,
    questionIds: readonly number[],
    previousQuestions: ReadonlyMap<number, ScoredQuestion>,
  ): Promise<{
    session: SessionState;
    regradedQuestionIds: readonly number[];
  }> {
    const { regradedQuestionIds, closestGuessSummaries } =
      await this.grading.regradeQuestions(
        session,
        questionIds,
        previousQuestions,
      );
    if (regradedQuestionIds.length === 0) {
      return { session, regradedQuestionIds };
    }

    const refresh = await this.grading.gradingRefresh(
      session,
      regradedQuestionIds,
    );
    return {
      session: withGradingRefresh(
        {
          ...session,
          closestGuessSummaries: {
            ...session.closestGuessSummaries,
            ...closestGuessSummaries,
          },
        },
        refresh,
      ),
      regradedQuestionIds,
    };
  }

  /**
   * The quiz behind a live session was edited in place (an editor save or a
   * re-import): a session write that reloads its questions and re-grades
   * `regradeQuestionIds` (already-shown questions whose answer/points were
   * corrected), so answers and grades that land at the same moment are
   * neither undone nor out of step with the ungraded markers. The outcome
   * names every re-scored question for a fresh admin answer list, and every
   * connected team with an answer to one for a per-team sync — so the
   * grading panel, the big screen and the phones all show the corrected
   * points. A reload always ends in a broadcast.
   */
  quizEdited(
    joinCode: string,
    regradeQuestionIds: readonly number[] = [],
  ): Promise<SessionOutcome> {
    return this.writeSession(joinCode, async (started) => {
      const previousQuestions = new Map(
        started.seededGame.rounds
          .flatMap((round) => round.questions)
          .map((question) => [question.id, question] as const),
      );
      const reloaded = await this.withReloadedQuiz(started);
      if (regradeQuestionIds.length === 0) {
        return { session: reloaded, outcome: BROADCAST_STATE_OUTCOME };
      }

      const { session, regradedQuestionIds } = await this.withRegradedQuestions(
        reloaded,
        regradeQuestionIds,
        previousQuestions,
      );
      if (regradedQuestionIds.length === 0) {
        return { session, outcome: BROADCAST_STATE_OUTCOME };
      }

      const answerLists = await Promise.all(
        regradedQuestionIds.map((questionId) =>
          this.answerService.listForQuestion(
            session.seededGame.gameSessionId,
            questionId,
          ),
        ),
      );
      const answeredTeamIds = new Set(
        answerLists.flat().map((answer) => answer.teamId),
      );
      const teamSyncTeamIds = buildSnapshot(session)
        .teams.filter(
          (team) => team.isConnected && answeredTeamIds.has(team.teamId),
        )
        .map((team) => team.teamId);
      return {
        session,
        outcome: {
          ...BROADCAST_STATE_OUTCOME,
          answerListQuestionIds: regradedQuestionIds,
          teamSyncTeamIds,
        },
      };
    });
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

  /** The team whose phone is on `socketId`, or null when that socket isn't a team's. */
  getTeamIdForSocket(joinCode: string, socketId: string): number | null {
    return findTeamIdBySocketId(this.sessionStore.get(joinCode), socketId);
  }

  /** Whether `roundId` is open for rating right now — the players view's feedback field is the same rule. */
  isRoundOpenForRating(joinCode: string, roundId: number): boolean {
    const feedback = getFeedbackField(this.sessionStore.get(joinCode));
    return feedback?.rounds.some((round) => round.id === roundId) ?? false;
  }

  /** The socket currently connected for `teamId`, if any. */
  getConnectedSocketId(joinCode: string, teamId: number): string | undefined {
    return this.sessionStore.get(joinCode).connectedTeamSockets[teamId];
  }

  /**
   * A team's socket joined: a session write that records its connection and
   * the session's roster (read inside the write, so it includes the team and
   * any removal that ran before it) together, so the next snapshot shows the
   * team as connected — and on the leaderboard from the moment it joins, at
   * zero points until it scores.
   */
  teamConnected(
    joinCode: string,
    teamId: number,
    socketId: string,
    loadRoster: RosterLoader,
  ): Promise<SessionOutcome> {
    return this.writeSession(joinCode, async (session) => ({
      session: withTeams(
        withTeamConnected(session, teamId, socketId),
        await loadRoster(),
      ),
      outcome: BROADCAST_STATE_OUTCOME,
    }));
  }

  /** A socket dropped: a session write (no standings read) that frees its team, if it held one. Null when the socket wasn't a team's — nothing to push. */
  teamDisconnected(
    joinCode: string,
    socketId: string,
  ): Promise<SessionOutcome | null> {
    return this.writeSession<SessionOutcome | null>(
      joinCode,
      (session) => {
        const teamId = findTeamIdBySocketId(session, socketId);
        return Promise.resolve(
          teamId === null
            ? { session, outcome: null }
            : {
                session: withoutTeamConnection(session, teamId),
                outcome: BROADCAST_STATE_OUTCOME,
              },
        );
      },
      NOT_TOUCHING_SCORES,
    );
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
  ): Promise<SessionOutcome> {
    return this.writeSession(
      joinCode,
      (session) =>
        Promise.resolve({
          session: withBreakEndTime(session, breakEndsAt),
          outcome: BROADCAST_STATE_OUTCOME,
        }),
      NOT_TOUCHING_SCORES,
    );
  }

  /** Admin-set text-size multiplier for every /display screen except the header — see StateSnapshotPayload.displayTextScale. */
  displayTextScaleSet(
    joinCode: string,
    displayTextScale: number,
  ): Promise<SessionOutcome> {
    return this.writeSession(
      joinCode,
      (session) =>
        Promise.resolve({
          session: withDisplayTextScale(session, displayTextScale),
          outcome: BROADCAST_STATE_OUTCOME,
        }),
      NOT_TOUCHING_SCORES,
    );
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
  ): Promise<SessionOutcome> {
    return this.writeSession(
      joinCode,
      (session) =>
        Promise.resolve({
          session: withActiveShowdownRound(session, round),
          outcome: BROADCAST_STATE_OUTCOME,
        }),
      NOT_TOUCHING_SCORES,
    );
  }

  /** A team's showdown guess was stored: the latest guess replaces any earlier one. */
  showdownGuessSubmitted(
    joinCode: string,
    teamId: number,
    value: string,
  ): Promise<SessionOutcome> {
    return this.writeSession(
      joinCode,
      (session) =>
        Promise.resolve({
          session: withShowdownGuess(session, teamId, value),
          outcome: BROADCAST_STATE_OUTCOME,
        }),
      NOT_TOUCHING_SCORES,
    );
  }

  /** This session's current settings — used by the gateway to filter enabled bonus categories. */
  getSessionSettings(joinCode: string): SessionSettings {
    return this.sessionStore.get(joinCode).seededGame.settings;
  }

  /**
   * Merges `partial` over the session's current settings, lobby-only — the
   * admin can keep adjusting settings freely up until START_QUIZ, at which
   * point the values in effect must stop moving under the game. A session
   * write (no standings read): the lobby check runs against the session the
   * previous write left, so a join or START_QUIZ queued first is respected.
   */
  async updateSessionSettings(
    joinCode: string,
    partial: Partial<SessionSettings>,
  ): Promise<void> {
    await this.writeSession(
      joinCode,
      async (session) => {
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
        return {
          session: {
            ...session,
            seededGame: { ...session.seededGame, settings },
          },
          outcome: undefined,
        };
      },
      NOT_TOUCHING_SCORES,
    );
  }

  /**
   * Applies an admin action (or a timer expiry standing in for one) and says
   * what must be pushed. Carries the press out through the Move committer —
   * every follow-up it implies (the fresh leaderboard when it is toggled on,
   * the per-team answer sync on reveal entry) comes back in the outcome — so
   * the admin path and both timer paths behave the same. A session write:
   * the commit runs against the session as the previous write left it, so
   * no other session write (answers, grades, bonuses, roster changes, other
   * presses) that landed while the press waited on the database is lost. The
   * session is stored only once its progress is saved,
   * so a refused press leaves it where it was. Throws whatever the commit
   * throws (illegal transition, ungraded answers, a failed save).
   */
  applyAdminAction(
    joinCode: string,
    action: GameAction,
  ): Promise<SessionOutcome> {
    return this.writeSession(joinCode, (session) =>
      this.moveCommitter.commit(session, action),
    );
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
   * A team left the session (kicked or left on its own): a session write that
   * drops the team's connection and swaps in the roster after its removal
   * (read inside the write), so the next snapshot never has one without the
   * other. A kick also carries TEAM_KICKED for the socket the team held when
   * the write ran, if it still has one.
   */
  teamRemoved(
    joinCode: string,
    teamId: number,
    loadRoster: RosterLoader,
    reason: 'kicked' | 'left',
  ): Promise<SessionOutcome> {
    return this.writeSession(joinCode, async (session) => {
      const socketId = session.connectedTeamSockets[teamId];
      const notices =
        reason === 'kicked' && socketId
          ? [
              {
                socketId,
                event: SOCKET_EVENTS.TEAM_KICKED,
                payload: undefined,
              },
            ]
          : [];
      return {
        session: withTeams(
          withoutTeamConnection(session, teamId),
          await loadRoster(),
        ),
        outcome: { ...BROADCAST_STATE_OUTCOME, notices },
      };
    });
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

  private refreshAfterAnswerChange(
    joinCode: string,
    questionId: number,
  ): Promise<SessionOutcome> {
    return this.writeSession(joinCode, async (started) => {
      const [answers, refresh] = await Promise.all([
        this.answerService.listForQuestion(
          started.seededGame.gameSessionId,
          questionId,
        ),
        this.grading.gradingRefresh(started, [questionId]),
      ]);
      return {
        session: withGradingRefresh(
          withAnsweredTeamIds(
            started,
            questionId,
            answers.map((answer) => answer.teamId),
          ),
          refresh,
        ),
        outcome: {
          ...BROADCAST_STATE_OUTCOME,
          answerListQuestionIds: [questionId],
        },
      };
    });
  }

  /**
   * A session write: runs `change` against the session as the previous write
   * for this join code left it, reads standings once as the last step
   * (unless the write says it doesn't change scores), stores the result and
   * returns the change's outcome. A change that throws stores nothing and
   * doesn't hold up the next write; a failed standings read, after the change
   * has done its work, is logged and the session is stored with its earlier
   * leaderboard. Not re-entrant: `change` must not call
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
      if (!refreshStandings) {
        this.sessionStore.set(joinCode, session);
        return outcome;
      }
      // The change has already done its database work (a press has saved its
      // progress), so it counts as done even if the standings read fails:
      // memory must match what was saved and clients must hear about it. The
      // session keeps its earlier leaderboard and the next write reads
      // standings again.
      let leaderboard: LeaderboardEntry[] | undefined;
      try {
        leaderboard = await this.standingsService.leaderboard(
          session.seededGame.gameSessionId,
        );
      } catch (error) {
        this.logger.error(
          `Standings read failed for session ${joinCode}; keeping the earlier leaderboard until the next write`,
          error instanceof Error ? error.stack : String(error),
        );
      }
      this.sessionStore.set(
        joinCode,
        leaderboard ? withLeaderboard(session, leaderboard) : session,
      );
      return outcome;
    });
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
