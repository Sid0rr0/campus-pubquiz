import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import {
  DEFAULT_SESSION_SETTINGS,
  SOCKET_EVENTS,
  getTiedForFirst,
  isGradedStatus,
  isShowdownAcceptingGuesses,
  type ActiveSessionSummary,
  type CreateShowdownRoundPayload,
  type JoinPlayersPayload,
  type AdminQuestionContext,
  type GameAction,
  type LeaderboardEntry,
  type LiveEditFrontier,
  type FeedbackField,
  type PresenterContextPayload,
  type RateRoundPayload,
  type SendFeedbackPayload,
  type ScoredQuestion,
  type SessionSettings,
  type SocketRoomName,
  type StateSnapshotPayload,
  type StateViewByRoom,
  type SubmitAnswerPayload,
  type SubmitShowdownGuessPayload,
  type AwardBonusPayload,
  type TeamBonusAwardView,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import { BonusService, InvalidBonusAwardError } from '@/bonus/bonus.service';
import { FEEDBACK_OFF_REASON } from '@/feedback/feedback-off-reason';
import { FeedbackService } from '@/feedback/feedback.service';
import { StandingsService } from '@/standings/standings.service';
import { SeedService } from '@/db/seed.service';
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
  type SessionState,
} from '@/game/state/session-state';
import {
  findTeamIdBySocketId,
  withActiveShowdownRound,
  withAnsweredTeamIds,
  withBreakEndTime,
  withDisplayTextScale,
  withLeaderboard,
  withShowdownGuess,
  withTeamConnected,
  withTeams,
  withoutTeamConnection,
} from '@/game/state/session-updates.util';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import {
  BROADCAST_STATE_OUTCOME,
  connectedTeamSyncs,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import {
  InvalidShowdownError,
  ShowdownService,
} from '@/showdown/showdown.service';
import { TeamService, type TeamRosterEntry } from '@/team/team.service';

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

/** Runs a showdown service call, turning its domain error into the refusal a team or the admin sees. */
async function refusingInvalidShowdown<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof InvalidShowdownError) {
      throw new SessionRefusal(error.message);
    }
    throw error;
  }
}

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
    private readonly teamService: TeamService,
    private readonly bonusService: BonusService,
    private readonly feedbackService: FeedbackService,
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

    return {
      session: await this.grading.gradesChanged(
        {
          ...session,
          closestGuessSummaries: {
            ...session.closestGuessSummaries,
            ...closestGuessSummaries,
          },
        },
        regradedQuestionIds,
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
    return this.writeSession(joinCode, (started) =>
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
    const teamSyncs = connectedTeamSyncs(
      session,
      session.teams
        .filter((team) => answeredTeamIds.has(team.teamId))
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
   * Runs the quiz edit on one session whose queue is held (see
   * holdQuizSessions, the only caller): the step, then the standings read,
   * then the store. Not queued; the outcome is delivered after the hold is
   * released.
   */
  private async applyQuizEdit(
    joinCode: string,
    regradeQuestionIds: readonly number[],
  ): Promise<SessionOutcome> {
    const { session, outcome } = await this.quizEditedStep(
      this.sessionStore.get(joinCode),
      regradeQuestionIds,
    );
    await this.storeWithStandings(joinCode, session);
    return outcome;
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
    return this.sessionWrites.hold(
      this.sessionStore
        .values()
        .filter(
          (session) =>
            session.seededGame.quizId === quizId &&
            session.progress.status !== 'ended',
        )
        .map((session) => session.seededGame.joinCode),
      () =>
        task({
          applyQuizEdit: (joinCode, regradeQuestionIds) =>
            this.applyQuizEdit(joinCode, regradeQuestionIds),
        }),
    );
  }

  /** Every running session on `quizId` (not in the lobby, not ended) as it stands now. Read it inside holdQuizSessions to count the sessions the way they stand while the game can't move. */
  listLiveSessions(quizId: number): SessionState[] {
    return this.sessionStore
      .values()
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
    return this.writeSession(
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
      const { team, joined } = await this.writeSession(
        joinCode,
        async (session) => {
          // Resolved inside the write, so a leave or kick for the same team
          // lands either wholly before or wholly after this join.
          const team = await this.teamService.join(
            session.seededGame.gameSessionId,
            request.teamName,
            {
              teamToken: request.teamToken,
              teamCode: request.teamCode,
              joinCode: request.joinCode,
            },
          );
          const heldBy = session.connectedTeamSockets[team.id];
          const takenOver =
            heldBy && heldBy !== socketId && isSocketLive(heldBy)
              ? heldBy
              : null;
          // A takeover is the same device auto-reconnecting on a fresh socket
          // before our ping timeout noticed its old one died (network switch,
          // phone waking up). Socket ids are random and never shared with other
          // clients, so only the device that held that socket can name it here.
          // Decided inside the write, so two joins racing for one seat can't
          // both pass.
          if (takenOver && request.previousSocketId !== takenOver) {
            throw new SessionRefusal(
              `"${team.name}" is already connected on another device — ask the quiz master to remove it, then try again.`,
            );
          }
          return {
            session: withTeams(
              withTeamConnected(session, team.id, socketId),
              await this.teamService.listForSession(
                session.seededGame.gameSessionId,
              ),
            ),
            outcome: {
              team,
              joined: {
                ...BROADCAST_STATE_OUTCOME,
                socketsToClose: takenOver ? [takenOver] : [],
              },
            },
          };
        },
      );

      return {
        ...joined,
        replies: [
          {
            event: SOCKET_EVENTS.JOIN_ACCEPTED,
            payload: {
              teamId: team.id,
              teamName: team.name,
              teamToken: team.token,
              teamCode: team.code,
              answers: await this.answerService.listForTeam(
                gameSessionId,
                team.id,
              ),
              bonusAwards: await this.bonusService.listForTeam(
                gameSessionId,
                team.id,
              ),
              roundRatings: await this.feedbackService.listRoundRatingsForTeam(
                gameSessionId,
                team.id,
              ),
              feedback: await this.feedbackService.getFeedbackForTeam(
                gameSessionId,
                team.id,
              ),
            },
          },
        ],
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
    { showdownRoundId, teamId, value }: SubmitShowdownGuessPayload,
    socketId: string,
  ): Promise<SessionOutcome> {
    return this.writeSession(
      joinCode,
      async (session) => {
        const round = session.activeShowdownRound;
        if (
          !isShowdownAcceptingGuesses(
            round,
            showdownRoundId,
            session.showdownRevealStep,
          )
        ) {
          throw new SessionRefusal(
            'This showdown round is no longer accepting guesses',
          );
        }
        if (session.connectedTeamSockets[teamId] !== socketId) {
          throw new SessionRefusal(
            'You may only submit guesses for your own team',
          );
        }
        if (!round?.participants.some((entry) => entry.teamId === teamId)) {
          throw new SessionRefusal(
            'Your team is not part of this showdown round',
          );
        }

        await refusingInvalidShowdown(() =>
          this.showdownService.submitGuess(showdownRoundId, teamId, value),
        );
        return {
          session: withShowdownGuess(session, teamId, value),
          outcome: BROADCAST_STATE_OUTCOME,
        };
      },
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
    { question, answer, points }: CreateShowdownRoundPayload,
  ): Promise<SessionOutcome> {
    return this.writeSession(
      joinCode,
      async (session) => {
        const tied = getTiedForFirst(session.leaderboard);
        if (tied.length < 2) {
          throw new SessionRefusal('No tie for first place to break');
        }

        const round = await refusingInvalidShowdown(() =>
          this.showdownService.createRound(
            session.seededGame.gameSessionId,
            tied.map(({ teamId, teamName }) => ({ teamId, teamName })),
            question,
            answer,
            points,
          ),
        );
        return {
          session: withActiveShowdownRound(session, round),
          outcome: BROADCAST_STATE_OUTCOME,
        };
      },
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
   * so a refused press leaves it where it was. Refuses with the commit's own
   * message (illegal transition, ungraded answers); a failed save is refused
   * the same way.
   */
  applyAdminAction(
    joinCode: string,
    action: GameAction,
  ): Promise<SessionOutcome> {
    return this.writeSession(joinCode, (session) =>
      this.moveCommitter.commit(session, action),
    ).catch((error: unknown) => {
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
    { teamId, questionId, value }: SubmitAnswerPayload,
    socketId: string,
  ): Promise<SessionOutcome> {
    return this.writeSession(joinCode, async (session) => {
      if (!isQuestionOpenForAnswering(session, questionId)) {
        throw new SessionRefusal('Answers are locked for this question');
      }
      if (session.connectedTeamSockets[teamId] !== socketId) {
        throw new SessionRefusal(
          'You may only submit answers for your own team',
        );
      }

      const responseMs =
        session.phaseStartedAt === null
          ? null
          : Date.now() - session.phaseStartedAt;
      const submitted = await this.answerService.submit(
        session.seededGame.gameSessionId,
        questionId,
        teamId,
        value,
        responseMs,
      );

      const refreshed = await this.answerChange(session, questionId);
      return {
        session: refreshed.session,
        outcome: {
          ...refreshed.outcome,
          replies: [
            {
              event: SOCKET_EVENTS.ANSWER_RECEIVED,
              payload: {
                questionId,
                teamId: submitted.teamId,
                teamName: submitted.teamName,
                value: submitted.value,
                pointsAwarded: submitted.pointsAwarded,
                gradedAt: submitted.gradedAt,
                verdict: submitted.verdict,
              },
            },
          ],
        },
      };
    });
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
    return this.writeSession(joinCode, async (session) => {
      let questionId: number;
      try {
        ({ questionId } = await this.answerService.grade(
          session.seededGame.gameSessionId,
          answerId,
          pointsAwarded,
        ));
      } catch (error) {
        throw new SessionRefusal(
          error instanceof Error ? error.message : 'Unable to grade answer',
        );
      }
      return await this.answerChange(session, questionId);
    });
  }

  /**
   * An admin awards a bonus. The session's own enabled categories and
   * per-category limit decide whether it is allowed (a refusal carries the
   * bonus service's message); the awarded team's socket, if connected, gets
   * the BONUS_AWARDED notice.
   */
  async awardBonus(
    joinCode: string,
    { teamId, category, points, reason }: AwardBonusPayload,
  ): Promise<SessionOutcome> {
    return this.writeSession(joinCode, async (session) => {
      const { enabledBonusCategories, maxBonusAwardsPerCategory } =
        session.seededGame.settings;
      try {
        await this.bonusService.award(
          session.seededGame.gameSessionId,
          teamId,
          category,
          points,
          reason,
          enabledBonusCategories,
          maxBonusAwardsPerCategory,
        );
      } catch (error) {
        if (error instanceof InvalidBonusAwardError) {
          throw new SessionRefusal(error.message);
        }
        throw error;
      }
      return this.bonusChange(session, {
        teamId,
        notice: { category, points, reason },
      });
    });
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
    return this.writeSession(joinCode, async (session) => {
      // Checked against the session as the previous write left it, so a
      // leave from a socket that just lost the seat to a rejoin is refused.
      if (session.connectedTeamSockets[teamId] !== socketId) {
        throw new SessionRefusal('Can only leave the session as your own team');
      }
      return await this.teamRemovedChange(session, teamId, 'left');
    });
  }

  /**
   * The admin kicks a team: removes it from the roster even when it has no
   * socket. The outcome carries TEAM_KICKED for the socket the team holds, if
   * any, and closes that socket after the notice.
   */
  kickTeam(joinCode: string, teamId: number): Promise<SessionOutcome> {
    return this.writeSession(joinCode, (session) =>
      this.teamRemovedChange(session, teamId, 'kicked'),
    );
  }

  /**
   * The change a team's removal makes, run inside the caller's own session
   * write: removes the team from the roster, then drops its connection and
   * swaps in the roster after its removal, so the next snapshot never has one
   * without the other. A kick also carries TEAM_KICKED for the socket the team
   * held when the write ran, if it still has one, then closes that socket.
   */
  private async teamRemovedChange(
    session: SessionState,
    teamId: number,
    reason: 'kicked' | 'left',
  ): Promise<{ session: SessionState; outcome: SessionOutcome }> {
    const { gameSessionId } = session.seededGame;
    await this.teamService.removeFromRoster(gameSessionId, teamId);
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
        await this.teamService.listForSession(gameSessionId),
      ),
      outcome: {
        ...BROADCAST_STATE_OUTCOME,
        notices,
        socketsToClose: notices.map((notice) => notice.socketId),
      },
    };
  }

  /**
   * A bonus award was added, edited or deleted: refreshes the leaderboard the
   * same way grading does. Carries no BONUS_AWARDED notice: callers that
   * award a bonus run `bonusChange` inside their own write instead.
   */
  bonusChanged(joinCode: string): Promise<SessionOutcome> {
    return this.writeSession(joinCode, (session) =>
      Promise.resolve(this.bonusChange(session)),
    );
  }

  /**
   * The change a bonus award makes, built from the session it is handed. Not
   * a write of its own — callers run it inside theirs. `awarded` (a fresh
   * award only) carries its BONUS_AWARDED notice for that team's socket, if
   * it is connected.
   */
  private bonusChange(
    session: SessionState,
    awarded?: { teamId: number; notice: TeamBonusAwardView },
  ): { session: SessionState; outcome: SessionOutcome } {
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
    return {
      session,
      outcome: { ...BROADCAST_STATE_OUTCOME, notices },
    };
  }

  /**
   * The change after an answer was stored or graded: the question's
   * answered-team ids and grading refresh, built from the session it is
   * handed. Not a write of its own — callers run it inside theirs.
   */
  private async answerChange(
    started: SessionState,
    questionId: number,
  ): Promise<{ session: SessionState; outcome: SessionOutcome }> {
    const [answers, graded] = await Promise.all([
      this.answerService.listForQuestion(
        started.seededGame.gameSessionId,
        questionId,
      ),
      this.grading.gradesChanged(started, [questionId]),
    ]);
    return {
      session: withAnsweredTeamIds(
        graded,
        questionId,
        answers.map((answer) => answer.teamId),
      ),
      outcome: {
        ...BROADCAST_STATE_OUTCOME,
        answerListQuestionIds: [questionId],
      },
    };
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
      if (refreshStandings) await this.storeWithStandings(joinCode, session);
      else this.sessionStore.set(joinCode, session);
      return outcome;
    });
  }

  /**
   * Stores `session` after reading its standings. The change has already
   * done its database work (a press has saved its progress), so it counts as
   * done even if the standings read fails: memory must match what was saved
   * and clients must hear about it. The session keeps its earlier leaderboard
   * and the next write reads standings again.
   */
  private async storeWithStandings(
    joinCode: string,
    session: SessionState,
  ): Promise<void> {
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
