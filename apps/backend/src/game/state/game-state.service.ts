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
  type FeedbackField,
  freshSessionState,
  type GameAction,
  getFeedbackField,
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
  type TeamRosterEntry,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import { BonusService } from '@/bonus/bonus.service';
import { FEEDBACK_OFF_REASON } from '@/feedback/feedback-off-reason';
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
import { ShowdownsChanges } from '@/game/state/showdowns-changes';
import { MoveCommitter } from '@/game/state/commit-a-move.service';
import { buildPresenterContext } from '@/game/state/screen-preview.util';
import { SessionCloseBlockedError } from '@/game/state/errors/session-close-blocked.error';
import { findTeamIdBySocketId } from '@/game/state/session-updates.util';
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

/** Reads the session's current roster from the database — run inside a session write, so it sees every removal and join that ran before it. */
/** What a hold on a quiz's sessions lets its task do to them: apply a quiz edit to one held session, returning the outcome to deliver once the hold is released. */
export interface HeldQuizSessions {
  applyQuizEdit(
    joinCode: string,
    regradeQuestionIds: readonly number[],
  ): Promise<SessionOutcome>;
}

export type RosterLoader = () => Promise<TeamRosterEntry[]>;

export { SessionCloseBlockedError } from '@/game/state/errors/session-close-blocked.error';
export { SessionSettingsUpdateBlockedError } from '@/game/state/errors/session-settings-update-blocked.error';

/** The option for a session write whose event doesn't change scores: skips the standings read. */
const NOT_TOUCHING_SCORES = { refreshStandings: false } as const;

/** The outcome of an event that is only acknowledged to its sender: no emits, no broadcast. */
const NOTHING_TO_PUSH_OUTCOME: SessionOutcome = {
  ...BROADCAST_STATE_OUTCOME,
  shouldBroadcastState: false,
};

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

  /**
   * A team rates a round of the break card. Checked against the session this
   * write holds: the socket belongs to a team, feedback is collected, and the
   * round is open for rating — so a rating sent as the break ends is either
   * saved before the press or refused after it. Stores the rating inside the
   * write; changes no scores and pushes nothing.
   */
  roundRated(
    joinCode: string,
    { roundId, stars }: RateRoundPayload,
    socketId: string,
  ): Promise<SessionOutcome> {
    return this.writeTeamFeedback(joinCode, socketId, {
      noTeamReason: 'Join a team before rating a round',
      closedReason: "This round can't be rated right now",
      isOpen: (feedback) =>
        feedback?.rounds.some((round) => round.id === roundId) ?? false,
      store: (gameSessionId, teamId) =>
        this.feedbackService.rateRound(gameSessionId, teamId, roundId, stars),
    });
  }

  /**
   * A team sends its comment and topic suggestions from the final form.
   * Checked and stored inside one session write, like `roundRated`, so
   * feedback is never stored after the final form closed.
   */
  feedbackSent(
    joinCode: string,
    { comment, topics }: SendFeedbackPayload,
    socketId: string,
  ): Promise<SessionOutcome> {
    return this.writeTeamFeedback(joinCode, socketId, {
      noTeamReason: 'Join a team before sending feedback',
      closedReason: "Feedback can't be sent right now",
      isOpen: (feedback) => feedback?.kind === 'final_form',
      store: (gameSessionId, teamId) =>
        this.feedbackService.sendFeedback(gameSessionId, teamId, {
          comment,
          topics,
        }),
    });
  }

  private writeTeamFeedback(
    joinCode: string,
    socketId: string,
    rules: {
      noTeamReason: string;
      closedReason: string;
      isOpen: (feedback: FeedbackField) => boolean;
      store: (gameSessionId: number, teamId: number) => Promise<void>;
    },
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(
      joinCode,
      async (session) => {
        const teamId = findTeamIdBySocketId(session, socketId);
        if (teamId === null) throw new SessionRefusal(rules.noTeamReason);
        if (!session.seededGame.settings.collectFeedback) {
          throw new SessionRefusal(FEEDBACK_OFF_REASON);
        }
        if (!rules.isOpen(getFeedbackField(session))) {
          throw new SessionRefusal(rules.closedReason);
        }
        await rules.store(session.seededGame.gameSessionId, teamId);
        return { session, outcome: NOTHING_TO_PUSH_OUTCOME };
      },
      NOT_TOUCHING_SCORES,
    );
  }

  /**
   * A team joins (or rejoins) from `socketId`. The team service resolves the
   * team; then the seat takeover rule applies: a live socket already holding
   * the seat refuses the join, unless the request names that socket as its
   * previous one — then it is listed to close. Records the connection and the
   * roster in one session write, so the team is on the leaderboard from the
   * moment it joins, at zero points until it scores. The join reply (saved
   * answers, bonus awards, ratings and feedback) goes to the sender before
   * any room push. `isSocketLive` comes from the socket layer, the only place
   * that knows whether a socket is still connected.
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

  /**
   * A showdown guess from `socketId`. A session write: inside it, checks the
   * showdown still accepts guesses, then that the socket owns the seat, then
   * that the team takes part, stores the guess and records it on the session.
   * Checked against the session the write holds, so a guess sent as the
   * reveal starts is either counted by the resolve or refused. The latest
   * guess replaces any earlier one.
   */
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

  /**
   * Starts a showdown round for the teams tied for first, in leaderboard
   * (seat) order. A session write: the tie is read from the leaderboard of
   * the session the write holds, so a round is only created for teams still
   * tied. Leaves
   * isLeaderboardVisible alone: the admin's own Hide Leaderboard press clears
   * it before the reveal starts, and forcing it here would yank the final
   * standings off the display the moment the tiebreaker question is saved.
   */
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
    await this.sessionWrite.write(
      joinCode,
      (session) => this.settingsChanges.lobbySettings(session, partial),
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
   * so a refused press leaves it where it was. Refuses with the commit's own
   * message (illegal transition, ungraded answers); a failed save is refused
   * the same way.
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

  /**
   * A team's answer arrived from `socketId`. Refuses it when the question is
   * no longer open or the socket doesn't own the team's seat; otherwise
   * measures the kahoot response time from the phase start that speed scoring
   * anchors to, stores the answer, refreshes the leaderboard, the question's
   * answered-team ids and its ungraded flag, and replies "answer received" to
   * the sender (graded points included for auto-graded types).
   */
  submitAnswer(
    joinCode: string,
    payload: SubmitAnswerPayload,
    socketId: string,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.answersChanges.submit(session, payload, socketId),
    );
  }

  /**
   * An admin grades an answer by hand. Refuses what the answer service
   * refuses (an unknown answer, a closest_guess answer); otherwise runs the
   * same refresh as submitAnswer for the answer's question.
   */
  async gradeAnswer(
    joinCode: string,
    answerId: number,
    pointsAwarded: number,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.answersChanges.grade(session, answerId, pointsAwarded),
    );
  }

  /**
   * An admin awards a bonus. A refusal carries the bonus service's message;
   * the awarded team's socket, if connected, gets the BONUS_AWARDED notice.
   */
  awardBonus(
    joinCode: string,
    payload: AwardBonusPayload,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.bonusChanges.award(session, payload),
    );
  }

  /**
   * A team leaves the session from `socketId`. Refuses unless that socket owns
   * the team's seat; otherwise removes the team from the roster and refreshes
   * the roster and leaderboard in every room.
   */
  teamLeft(
    joinCode: string,
    teamId: number,
    socketId: string,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.rosterChanges.leave(session, { teamId, socketId }),
    );
  }

  /**
   * The admin kicks a team: removes it from the roster even when it has no
   * socket. The outcome carries TEAM_KICKED for the socket the team holds, if
   * any, and closes that socket after the notice.
   */
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
