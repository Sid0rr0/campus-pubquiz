import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import {
  type ActiveSessionSummary,
  type AdminQuestionContext,
  type AwardBonusPayload,
  buildAdminQuestionContext,
  buildSnapshot,
  type CreateShowdownRoundPayload,
  DEFAULT_SESSION_SETTINGS,
  freshSessionState,
  type GameAction,
  isGradedStatus,
  type JoinPlayersPayload,
  type LiveEditFrontier,
  LOBBY_PROGRESS,
  type PresenterContextPayload,
  projectScreen,
  type RateRoundPayload,
  type SendFeedbackPayload,
  type SessionSettings,
  type SessionState,
  type SocketRoomName,
  type StateSnapshotPayload,
  type StateViewByRoom,
  type SubmitAnswerPayload,
  type SubmitShowdownGuessPayload,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import { BonusService } from '@/bonus/bonus.service';
import { FeedbackService } from '@/feedback/feedback.service';
import { StandingsService } from '@/standings/standings.service';
import { SeedService } from '@/db/seed.service';
import { GameProgressRepository } from '@/game/state/game-progress.repository';
import { BlockGradingService } from '@/game/state/block-grading.service';
import { SessionWrite } from '@/game/state/session-write';
import { AnswersChanges } from '@/game/state/answers-changes';
import { BonusAwardsChanges } from '@/game/state/bonus-awards-changes';
import { SessionSettingsChanges } from '@/game/state/session-settings-changes';
import { TeamRosterChanges } from '@/game/state/team-roster-changes';
import { TeamFeedbackChanges } from '@/game/state/team-feedback-changes';
import { ShowdownsChanges } from '@/game/state/showdowns-changes';
import { MoveCommitter } from '@/game/state/commit-a-move.service';
import { buildPresenterContext } from '@/game/state/screen-preview.util';
import { SessionCloseBlockedError } from '@/game/state/errors/session-close-blocked.error';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import {
  BROADCAST_STATE_OUTCOME,
  connectedTeamSyncs,
  type DeadlineChange,
  deadlinesOf,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import { ShowdownService } from '@/showdown/showdown.service';
import { TeamService } from '@/team/team.service';

/** What a hold on a quiz's sessions lets its task do to them: apply a quiz edit to one held session, returning the outcome to deliver once the hold is released. */
export interface HeldQuizSessions {
  applyQuizEdit(
    joinCode: string,
    regradeQuestionIds: readonly number[],
  ): Promise<SessionOutcome>;
}

export { SessionCloseBlockedError } from '@/game/state/errors/session-close-blocked.error';
export { SessionSettingsUpdateBlockedError } from '@/game/state/errors/session-settings-update-blocked.error';

/** The option for a session write whose event doesn't change scores: skips the standings read. */
const NOT_TOUCHING_SCORES = { refreshStandings: false } as const;

@Injectable()
export class GameStateService implements OnModuleInit {
  // A string, not `GameStateService.name`: `nest build` crashes with
  // "reading 'checkJsDirective'" on that self-reference in this file.
  private readonly logger = new Logger('GameStateService');
  private readonly sessionWrite: SessionWrite;
  private readonly grading: BlockGradingService;
  private readonly moveCommitter: MoveCommitter;
  private readonly settingsChanges: SessionSettingsChanges;
  private readonly answersChanges: AnswersChanges;
  private readonly bonusChanges: BonusAwardsChanges;
  private readonly rosterChanges: TeamRosterChanges;
  private readonly feedbackChanges: TeamFeedbackChanges;
  private readonly showdownsChanges: ShowdownsChanges;

  constructor(
    private readonly seedService: SeedService,
    private readonly progressRepository: GameProgressRepository,
    private readonly orm: MikroORM,
    private readonly answerService: AnswerService,
    private readonly standingsService: StandingsService,
    private readonly showdownService: ShowdownService,
    private readonly teamService: TeamService,
    private readonly bonusService: BonusService,
    private readonly feedbackService: FeedbackService,
  ) {
    this.sessionWrite = new SessionWrite(this.standingsService);
    this.grading = new BlockGradingService(this.answerService);
    this.settingsChanges = new SessionSettingsChanges(this.seedService);
    this.answersChanges = new AnswersChanges(this.answerService, this.grading);
    this.bonusChanges = new BonusAwardsChanges(this.bonusService);
    this.rosterChanges = new TeamRosterChanges(
      this.teamService,
      this.answerService,
      this.bonusService,
      this.feedbackService,
    );
    this.feedbackChanges = new TeamFeedbackChanges(this.feedbackService);
    this.showdownsChanges = new ShowdownsChanges(this.showdownService);
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
    this.sessionWrite.place(
      seededGame.joinCode,
      await this.moveCommitter.place(
        freshSessionState(seededGame),
        progress,
        saved ?? undefined,
      ),
    );
    this.sessionWrite.markInitialized();
  }

  /** Whether a session exists for this joinCode — lets the gateway reject a handshake's `?code=` before trusting it. */
  hasSession(joinCode: string): boolean {
    return this.sessionWrite.has(joinCode);
  }

  getGameSessionId(joinCode: string): number {
    return this.sessionWrite.read(joinCode).seededGame.gameSessionId;
  }

  getActiveQuizId(joinCode: string): number {
    return this.sessionWrite.read(joinCode).seededGame.quizId;
  }

  /** Every currently-running session, for the admin session picker (`GET /sessions`). Titles, names, and start times are filled in by the caller — this service only knows quizId, not quiz/GameSession metadata. */
  listSessions(): Omit<
    ActiveSessionSummary,
    'quizTitle' | 'name' | 'startedAt'
  >[] {
    return this.sessionWrite.list().map((session) => ({
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
    return this.sessionWrite.idle(joinCode);
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
    return this.sessionWrite.remove(joinCode, (session) => {
      if (session.progress.status !== 'ended') {
        throw new SessionCloseBlockedError(
          joinCode,
          `still in progress (status: "${session.progress.status}")`,
        );
      }
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
    this.sessionWrite.place(
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
    return this.sessionWrite.write(joinCode, (started) =>
      this.quizEditedStep(started, regradeQuestionIds),
    );
  }

  /**
   * The change of a quiz edit: reloads the session's questions and re-grades
   * `regradeQuestionIds`, taking and returning a session value. It stores
   * nothing and never queues, so it runs inside quizEdited's session write —
   * or, for a save that holds the quiz's sessions (the Live edit module),
   * inside applyQuizEdit. Private: the only way to reach it unqueued is the
   * hold's callback.
   */
  private async quizEditedStep(
    started: SessionState,
    regradeQuestionIds: readonly number[],
  ): Promise<{ session: SessionState; outcome: SessionOutcome }> {
    const reloaded = await this.withReloadedQuiz(started);
    if (regradeQuestionIds.length === 0) {
      return { session: reloaded, outcome: BROADCAST_STATE_OUTCOME };
    }

    const { session, regradedQuestionIds, answeringTeamIds } =
      await this.grading.regradeForKeyFix(
        reloaded,
        started,
        regradeQuestionIds,
      );
    if (regradedQuestionIds.length === 0) {
      return { session, outcome: BROADCAST_STATE_OUTCOME };
    }

    const teamSyncs = connectedTeamSyncs(
      session,
      session.teams
        .filter((team) => answeringTeamIds.has(team.teamId))
        .map((team) => team.teamId),
    );
    return {
      session,
      outcome: {
        ...BROADCAST_STATE_OUTCOME,
        answerListQuestionIds: regradedQuestionIds,
        teamSyncs,
      },
    };
  }

  /**
   * Runs `task` while holding the session writes of every unfinished session
   * on `quizId` (the Live edit module's save). Lobby sessions are held too,
   * so one that starts while the save waits is seen when the task looks at
   * which sessions are live. The task gets the held quiz's way to apply a
   * quiz edit to a session — usable only while the hold lasts.
   */
  holdQuizSessions<T>(
    quizId: number,
    task: (held: HeldQuizSessions) => Promise<T>,
  ): Promise<T> {
    return this.sessionWrite.hold(
      this.sessionWrite
        .list()
        .filter(
          (session) =>
            session.seededGame.quizId === quizId &&
            session.progress.status !== 'ended',
        )
        .map((session) => session.seededGame.joinCode),
      (writer) =>
        task({
          applyQuizEdit: (joinCode, regradeQuestionIds) =>
            writer.write(joinCode, (started) =>
              this.quizEditedStep(started, regradeQuestionIds),
            ),
        }),
    );
  }

  /** Every running session on `quizId` (not in the lobby, not ended) as it stands now. Read it inside holdQuizSessions to count the sessions the way they stand while the game can't move. */
  listLiveSessions(quizId: number): SessionState[] {
    return this.sessionWrite
      .list()
      .filter(
        (session) =>
          session.seededGame.quizId === quizId &&
          session.progress.status !== 'lobby' &&
          session.progress.status !== 'ended',
      );
  }

  /**
   * Where this session has got to, for protecting it against live editing
   * (`QuizController`): the questions that have opened, for good — Previous
   * stepping back never takes one away — and the current round, which is the
   * round of the furthest opened question if Previous stepped back before it —
   * and whether that round's block has started locking. Everything after the
   * opened questions stays editable until it has.
   */
  getLiveEditFrontier(session: SessionState): LiveEditFrontier {
    const openedIds = new Set(session.openedQuestionIds);
    // Previous can step back before opened questions, but they keep their
    // place for good — so the line never falls behind the furthest opened one.
    const furthestOpenedRoundIndex = session.seededGame.rounds.findLastIndex(
      (round) => round.questions.some((question) => openedIds.has(question.id)),
    );
    const currentRoundIndex = Math.max(
      session.progress.roundIndex,
      furthestOpenedRoundIndex,
    );
    const { status, roundIndex } = session.progress;
    return {
      openedQuestionIds: session.openedQuestionIds,
      currentRoundIndex,
      // Stepped back before the furthest opened round, its block may already
      // have locked — keep that round frozen rather than guess.
      hasCurrentBlockStartedLocking:
        status === 'locking' ||
        isGradedStatus(status) ||
        roundIndex < currentRoundIndex,
    };
  }

  /** A team rates a round of the break card. Changes no scores and pushes nothing. */
  roundRated(
    joinCode: string,
    payload: RateRoundPayload,
    socketId: string,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(
      joinCode,
      (session) => this.feedbackChanges.roundRated(session, payload, socketId),
      NOT_TOUCHING_SCORES,
    );
  }

  /** A team sends its comment and topic suggestions from the final form. Like `roundRated`. */
  feedbackSent(
    joinCode: string,
    payload: SendFeedbackPayload,
    socketId: string,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(
      joinCode,
      (session) =>
        this.feedbackChanges.feedbackSent(session, payload, socketId),
      NOT_TOUCHING_SCORES,
    );
  }

  /**
   * A team joins (or rejoins) from `socketId`; see the team roster change
   * module for the seat takeover rule. The join reply goes to the sender
   * before any room push. `isSocketLive` comes from the socket layer.
   */
  async teamJoined(
    joinCode: string,
    request: JoinPlayersPayload,
    socketId: string,
    isSocketLive: (socketId: string) => boolean,
  ): Promise<SessionOutcome> {
    const gameSessionId = this.getGameSessionId(joinCode);
    try {
      const { team, joined } = await this.sessionWrite.write(
        joinCode,
        (session) =>
          this.rosterChanges.join(session, { request, socketId, isSocketLive }),
      );

      return {
        ...joined,
        replies: [await this.rosterChanges.joinReply(gameSessionId, team)],
      };
    } catch (error) {
      if (error instanceof SessionRefusal) throw error;
      throw new SessionRefusal(
        error instanceof Error ? error.message : 'Unable to join',
      );
    }
  }

  /** A socket dropped: a session write (no standings read) that frees its team, if it held one. Null when the socket wasn't a team's — nothing to push. */
  teamDisconnected(
    joinCode: string,
    socketId: string,
  ): Promise<SessionOutcome | null> {
    return this.sessionWrite.write<SessionOutcome | null>(
      joinCode,
      (session) => this.rosterChanges.disconnect(session, socketId),
      NOT_TOUCHING_SCORES,
    );
  }

  getSnapshot(joinCode: string): StateSnapshotPayload {
    return buildSnapshot(this.sessionWrite.read(joinCode));
  }

  /** The view of the session that one room is sent — see projectScreen. */
  getView<Room extends SocketRoomName>(
    joinCode: string,
    room: Room,
  ): StateViewByRoom[Room] {
    return projectScreen(this.sessionWrite.read(joinCode), room);
  }

  /** Both auto-lock deadlines (epoch-ms, or null when none is armed). */
  getDeadlines(joinCode: string): DeadlineChange {
    return deadlinesOf(this.sessionWrite.read(joinCode));
  }

  /** Epoch-ms deadline for auto-locking the current question, or null when none is armed. */
  getQuestionLockAt(joinCode: string): number | null {
    return this.getDeadlines(joinCode).questionLockAt;
  }

  /** Epoch-ms deadline for auto-locking the currently-open kahootMode question, or null when none is armed. */
  getKahootQuestionEndsAt(joinCode: string): number | null {
    return this.getDeadlines(joinCode).kahootQuestionEndsAt;
  }

  /** Admin-set/clear the epoch-ms time the break is expected to end — see StateSnapshotPayload.breakEndsAt. */
  breakEndTimeSet(
    joinCode: string,
    breakEndsAt: number | null,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(
      joinCode,
      (session) => this.settingsChanges.breakEndTime(session, breakEndsAt),
      NOT_TOUCHING_SCORES,
    );
  }

  /** Admin-set text-size multiplier for every /display screen except the header — see StateSnapshotPayload.displayTextScale. */
  displayTextScaleSet(
    joinCode: string,
    displayTextScale: number,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(
      joinCode,
      (session) =>
        this.settingsChanges.displayTextScale(session, displayTextScale),
      NOT_TOUCHING_SCORES,
    );
  }

  /** A showdown guess from `socketId`; checked against the session the write holds, so a guess sent as the reveal starts is counted or refused. */
  submitShowdownGuess(
    joinCode: string,
    payload: SubmitShowdownGuessPayload,
    socketId: string,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(
      joinCode,
      (session) => this.showdownsChanges.guess(session, payload, socketId),
      NOT_TOUCHING_SCORES,
    );
  }

  /** Starts a showdown round for the teams tied for first, read from the session the write holds. Leaves isLeaderboardVisible alone. */
  createShowdownRound(
    joinCode: string,
    payload: CreateShowdownRoundPayload,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(
      joinCode,
      (session) => this.showdownsChanges.newRound(session, payload),
      NOT_TOUCHING_SCORES,
    );
  }

  /** Merges `partial` over the session's settings, lobby-only: the check runs against the session the previous write left. */
  async updateSessionSettings(
    joinCode: string,
    partial: Partial<SessionSettings>,
  ): Promise<void> {
    await this.sessionWrite.write(
      joinCode,
      (session) => this.settingsChanges.lobbySettings(session, partial),
      NOT_TOUCHING_SCORES,
    );
  }

  /**
   * Applies an admin action (or a timer expiry standing in for one) through
   * the Move committer, inside a session write, so no other write that landed
   * meanwhile is lost. A refused press (or failed save) leaves the session
   * where it was and is refused with the commit's own message.
   */
  applyAdminAction(
    joinCode: string,
    action: GameAction,
  ): Promise<SessionOutcome> {
    return this.sessionWrite
      .write(joinCode, (session) => this.moveCommitter.commit(session, action))
      .catch((error: unknown) => {
        throw new SessionRefusal(
          error instanceof Error ? error.message : 'Invalid game action',
        );
      });
  }

  /** A team's answer from `socketId`: refused when the question is closed or the seat isn't the socket's; see the answers change module. */
  submitAnswer(
    joinCode: string,
    payload: SubmitAnswerPayload,
    socketId: string,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.answersChanges.submit(session, payload, socketId),
    );
  }

  /** An admin grades an answer by hand; runs the same refresh as submitAnswer. */
  async gradeAnswer(
    joinCode: string,
    answerId: number,
    pointsAwarded: number,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.answersChanges.grade(session, answerId, pointsAwarded),
    );
  }

  /** An admin awards a bonus; a refusal carries the bonus service's message. */
  awardBonus(
    joinCode: string,
    payload: AwardBonusPayload,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.bonusChanges.award(session, payload),
    );
  }

  /** A team leaves from `socketId`; refused unless that socket owns the seat. */
  teamLeft(
    joinCode: string,
    teamId: number,
    socketId: string,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.rosterChanges.leave(session, { teamId, socketId }),
    );
  }

  /** The admin kicks a team, even one with no socket; the team's socket, if any, gets TEAM_KICKED and is closed. */
  kickTeam(joinCode: string, teamId: number): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.rosterChanges.kick(session, teamId),
    );
  }

  /** A bonus award was added, edited or deleted: refreshes the leaderboard. */
  bonusChanged(joinCode: string): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.bonusChanges.changed(session),
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
    const rounds = this.sessionWrite.read(joinCode).seededGame.rounds;
    return buildAdminQuestionContext(rounds, questionId);
  }

  /**
   * Host notes for the open question + a preview of the next question, for
   * the /remote presenter view alone. Callers MUST only forward this over
   * an admin-room-only channel (PRESENTER_CONTEXT_UPDATED) — never through
   * the broadcast snapshot.
   */
  getPresenterContext(joinCode: string): PresenterContextPayload {
    return buildPresenterContext(this.sessionWrite.read(joinCode));
  }
}
