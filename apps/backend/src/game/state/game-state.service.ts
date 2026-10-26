import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnModuleInit,
} from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import {
  type ActiveSessionSummary,
  type AdminQuestionContext,
  type AwardBonusPayload,
  type BonusAwardAdminView,
  buildAdminQuestionContext,
  buildSnapshot,
  type CreateShowdownRoundPayload,
  DEFAULT_SESSION_SETTINGS,
  freshSessionState,
  type GameAction,
  type JoinPlayersPayload,
  LOBBY_PROGRESS,
  type PickJokerPayload,
  type SetTeamJokerPayload,
  type PresenterContextPayload,
  projectScreen,
  type RateRoundPayload,
  type RateSessionPayload,
  type SendFeedbackPayload,
  type SessionSettings,
  type SessionState,
  type SetPlayerCountPayload,
  type SetTeamPlayerCountPayload,
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
import {
  JOKER_RANDOM,
  JokerChanges,
  type RandomSource,
} from '@/game/state/joker-changes';
import { JokerService } from '@/joker/joker.service';
import { TeamRosterChanges } from '@/game/state/team-roster-changes';
import { TeamFeedbackChanges } from '@/game/state/team-feedback-changes';
import { TeamPlayerCountChanges } from '@/game/state/team-player-count-changes';
import { PlayerCountService } from '@/player-count/player-count.service';
import { ShowdownsChanges } from '@/game/state/showdowns-changes';
import { MoveCommitter } from '@/game/state/commit-a-move.service';
import { buildPresenterContext } from '@/game/state/screen-preview.util';
import { SessionCloseBlockedError } from '@/game/state/errors/session-close-blocked.error';
import { QuizHasEmptyRoundError } from '@/game/state/errors/quiz-has-empty-round.error';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import {
  type DeadlineChange,
  deadlinesOf,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import { LeagueChanges } from '@/game/state/league-changes';
import { LeagueTableService } from '@/league/league-table.service';
import { LeagueService } from '@/league/league.service';
import { ShowdownService } from '@/showdown/showdown.service';
import { TeamService } from '@/team/team.service';
import { sessionDisplayName } from '@/ended-sessions-read/session-display-name';

export { QuizHasEmptyRoundError } from '@/game/state/errors/quiz-has-empty-round.error';
export { SessionCloseBlockedError } from '@/game/state/errors/session-close-blocked.error';
export { SessionSettingsInvalidError } from '@/game/state/errors/session-settings-invalid.error';
export { SessionSettingsUpdateBlockedError } from '@/game/state/errors/session-settings-update-blocked.error';

/** The one place a held session becomes its picker summary. */
function summarizeSession(session: SessionState): ActiveSessionSummary {
  const { seededGame } = session;
  return {
    joinCode: seededGame.joinCode,
    quizId: seededGame.quizId,
    quizTitle: seededGame.quizTitle,
    name: sessionDisplayName(seededGame.customName, seededGame.quizTitle),
    status: session.progress.status,
    teamCount: session.teams.length,
    startedAt: seededGame.startedAt.toISOString(),
  };
}

@Injectable()
export class GameStateService implements OnModuleInit {
  // A string, not `GameStateService.name`: `nest build` crashes with
  // "reading 'checkJsDirective'" on that self-reference in this file.
  private readonly logger = new Logger('GameStateService');
  private readonly moveCommitter: MoveCommitter;
  private readonly settingsChanges: SessionSettingsChanges;
  private readonly answersChanges: AnswersChanges;
  private readonly bonusChanges: BonusAwardsChanges;
  private readonly rosterChanges: TeamRosterChanges;
  private readonly feedbackChanges: TeamFeedbackChanges;
  private readonly playerCountChanges: TeamPlayerCountChanges;
  private readonly showdownsChanges: ShowdownsChanges;
  private readonly leagueChanges: LeagueChanges;
  private readonly jokerChanges: JokerChanges;

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
    private readonly playerCountService: PlayerCountService,
    private readonly sessionWrite: SessionWrite,
    private readonly grading: BlockGradingService,
    private readonly leagueTableService: LeagueTableService,
    private readonly leagueService: LeagueService,
    private readonly jokerService: JokerService,
    @Optional() @Inject(JOKER_RANDOM) random?: RandomSource,
  ) {
    this.jokerChanges = new JokerChanges(
      this.jokerService,
      this.teamService,
      random ?? Math.random,
    );
    this.settingsChanges = new SessionSettingsChanges(this.seedService);
    this.answersChanges = new AnswersChanges(this.answerService, this.grading);
    this.bonusChanges = new BonusAwardsChanges(this.bonusService);
    this.rosterChanges = new TeamRosterChanges(
      this.teamService,
      this.answerService,
      this.bonusService,
      this.feedbackService,
      this.playerCountService,
      this.jokerChanges,
    );
    this.feedbackChanges = new TeamFeedbackChanges(this.feedbackService);
    this.playerCountChanges = new TeamPlayerCountChanges(
      this.playerCountService,
      this.standingsService,
    );
    this.showdownsChanges = new ShowdownsChanges(this.showdownService);
    this.leagueChanges = new LeagueChanges(
      this.leagueService,
      this.leagueTableService,
      this.settingsChanges,
    );
    this.moveCommitter = new MoveCommitter(
      this.grading,
      this.progressRepository,
      this.sessionWrite.liveResultsRead,
      this.showdownService,
      (gameSessionId) => this.leagueChanges.topOrNull(gameSessionId),
      this.jokerChanges,
    );
  }

  /**
   * Re-reads the lobby league of every live session after an admin edited or
   * deleted a league, or added or removed one of its sessions. Returns the
   * join codes whose league changed, for the caller to broadcast: this pushes
   * nothing itself. A session closed meanwhile is skipped, and so is
   * `exceptJoinCode` (the session whose own change set the refresh off). A
   * failed league read leaves that session's league top as it was and is logged.
   */
  async refreshLeagueTops(exceptJoinCode?: string): Promise<string[]> {
    const changed: string[] = [];
    for (const { seededGame } of this.sessionWrite.list()) {
      const { joinCode } = seededGame;
      if (joinCode === exceptJoinCode) continue;
      try {
        const before = this.sessionWrite.read(joinCode).leagueTop;
        await this.sessionWrite.write(joinCode, (session) =>
          this.leagueChanges.refreshTop(session),
        );
        const after = this.sessionWrite.read(joinCode).leagueTop;
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          changed.push(joinCode);
        }
      } catch (error) {
        if (!this.sessionWrite.has(joinCode)) continue;
        this.logger.error(
          `League top refresh failed for session ${joinCode}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return changed;
  }

  // onModuleInit runs at bootstrap, before any HTTP/socket request has
  // entered the app, so there is no per-request MikroORM context yet for
  // the injected repositories to use — @CreateRequestContext() forks one.
  @CreateRequestContext()
  async onModuleInit(): Promise<void> {
    for (const seededGame of await this.seedService.seedOpenGames()) {
      const saved = await this.progressRepository.load(
        seededGame.gameSessionId,
      );
      const progress = saved?.progress ?? { ...LOBBY_PROGRESS };
      this.sessionWrite.place(
        seededGame.joinCode,
        await this.moveCommitter.place(
          freshSessionState(seededGame),
          progress,
          saved ?? undefined,
        ),
      );
    }
    this.sessionWrite.markInitialized();
  }

  /** Whether a session exists for this joinCode — lets the gateway reject a handshake's `?code=` before trusting it. */
  hasSession(joinCode: string): boolean {
    return this.sessionWrite.has(joinCode);
  }

  /** Whether the session with this database id is still held in memory (not yet closed). */
  isHeld(gameSessionId: number): boolean {
    return this.sessionWrite
      .list()
      .some(({ seededGame }) => seededGame.gameSessionId === gameSessionId);
  }

  getGameSessionId(joinCode: string): number {
    return this.sessionWrite.read(joinCode).seededGame.gameSessionId;
  }

  getActiveQuizId(joinCode: string): number {
    return this.sessionWrite.read(joinCode).seededGame.quizId;
  }

  /** Every currently-held session's summary, for the admin and public session pickers (`GET /sessions`). */
  listSessions(): ActiveSessionSummary[] {
    return this.sessionWrite.list().map(summarizeSession);
  }

  /**
   * Updates the held session's custom name after the stats page renamed (or
   * cleared) the ended session's row, so the pickers show it straight away.
   * Does nothing when the session isn't held (closed, or evicted). An ordinary
   * write that doesn't touch scores and broadcasts nothing.
   */
  async renameHeldSession(
    gameSessionId: number,
    customName: string | null,
  ): Promise<void> {
    const held = this.sessionWrite
      .list()
      .find(({ seededGame }) => seededGame.gameSessionId === gameSessionId);
    if (!held) return;
    const { joinCode } = held.seededGame;
    try {
      await this.sessionWrite.write(joinCode, (session) =>
        this.settingsChanges.customName(session, customName),
      );
    } catch (error) {
      // Closed between the lookup and the write: nothing left to update.
      if (this.sessionWrite.has(joinCode)) throw error;
    }
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
  async closeSession(joinCode: string): Promise<void> {
    let gameSessionId = 0;
    await this.sessionWrite.remove(joinCode, (session) => {
      if (session.progress.status !== 'ended') {
        throw new SessionCloseBlockedError(
          joinCode,
          `still in progress (status: "${session.progress.status}")`,
        );
      }
      gameSessionId = session.seededGame.gameSessionId;
    });
    await this.seedService.markClosed(gameSessionId);
  }

  /**
   * Allocates a brand-new GameSession/joinCode for `quizId`, leaving any
   * other session's state untouched. Not blocked by another session's
   * progress — `POST /sessions` lets an admin start additional concurrent
   * games regardless of how far along any other session is. `leagueIds`
   * (already checked by the caller) are ticked inside a session write.
   */
  async createSession(
    quizId: number,
    settings: SessionSettings = DEFAULT_SESSION_SETTINGS,
    name?: string,
    leagueIds: number[] = [],
  ): Promise<ActiveSessionSummary> {
    const joinCode = await this.placeNewSession(
      quizId,
      settings,
      name,
      leagueIds,
    );
    return summarizeSession(this.sessionWrite.read(joinCode));
  }

  /** Like `createSession`, for a caller that wants the new session's full state snapshot rather than its picker summary. */
  async createSessionSnapshot(
    quizId: number,
    settings: SessionSettings = DEFAULT_SESSION_SETTINGS,
    name?: string,
    leagueIds: number[] = [],
  ): Promise<StateSnapshotPayload> {
    const joinCode = await this.placeNewSession(
      quizId,
      settings,
      name,
      leagueIds,
    );
    return this.getSnapshot(joinCode);
  }

  private async placeNewSession(
    quizId: number,
    settings: SessionSettings,
    name: string | undefined,
    leagueIds: number[],
  ): Promise<string> {
    // Refused before the session row is written, so a refused start stores nothing.
    const quizRounds = await this.seedService.loadQuizRounds(quizId);
    const emptyRoundIndex = quizRounds.findIndex(
      (round) => round.questions.length === 0,
    );
    if (emptyRoundIndex !== -1) {
      throw new QuizHasEmptyRoundError(
        emptyRoundIndex + 1,
        quizRounds[emptyRoundIndex].title,
      );
    }
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
    if (leagueIds.length > 0) {
      await this.sessionWrite.write(seededGame.joinCode, (session) =>
        this.leagueChanges.setLeagues(session, leagueIds),
      );
    }
    return seededGame.joinCode;
  }

  /** A team picks its joker round from `socketId` during the joker pick; refused otherwise. Only the team's own phones and the admin room are told. */
  jokerPicked(
    joinCode: string,
    payload: PickJokerPayload,
    socketId: string,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.jokerChanges.pick(session, payload, socketId),
    );
  }

  /** The quiz master sets a team's joker round; refused for a round that has started or a team not in the session. Only that team's phones and the admin room are told. */
  teamJokerSet(
    joinCode: string,
    payload: SetTeamJokerPayload,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.jokerChanges.setTeamJoker(session, payload),
    );
  }

  /** A team rates a round of the break card. Changes no scores and pushes nothing. */
  roundRated(
    joinCode: string,
    payload: RateRoundPayload,
    socketId: string,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.feedbackChanges.roundRated(session, payload, socketId),
    );
  }

  /** A team reports how many players it has. Changes no scores and broadcasts nothing; only the team's own phones are told. */
  playerCountSet(
    joinCode: string,
    payload: SetPlayerCountPayload,
    socketId: string,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.playerCountChanges.playerCountSet(session, payload, socketId),
    );
  }

  /** The quiz master or a moderator sets or corrects a team's player count. Like `playerCountSet`, plus the admin room's view is refreshed. */
  teamPlayerCountSet(
    joinCode: string,
    payload: SetTeamPlayerCountPayload,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.playerCountChanges.teamPlayerCountSet(session, payload),
    );
  }

  /** A team sends its comment and topic suggestions from the final form. Like `roundRated`. */
  feedbackSent(
    joinCode: string,
    payload: SendFeedbackPayload,
    socketId: string,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.feedbackChanges.feedbackSent(session, payload, socketId),
    );
  }

  /** A team answers pacing or felt difficulty on the final form. Like `feedbackSent`, and leaves the comment and topics alone. */
  sessionRated(
    joinCode: string,
    payload: RateSessionPayload,
    socketId: string,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.feedbackChanges.sessionRated(session, payload, socketId),
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
      const { team, heldJoker, joined } = await this.sessionWrite.write(
        joinCode,
        (session) =>
          this.rosterChanges.join(session, { request, socketId, isSocketLive }),
      );

      return {
        ...joined,
        replies: [
          await this.rosterChanges.joinReply(gameSessionId, team, heldJoker),
        ],
      };
    } catch (error) {
      if (error instanceof SessionRefusal) throw error;
      throw new SessionRefusal(
        // Stryker disable next-line StringLiteral: unreachable defensive fallback, every failure on this path is an Error; the text only fills a refusal that is never produced.
        error instanceof Error ? error.message : 'Unable to join',
      );
    }
  }

  /** A socket dropped: a session write (no standings read) that frees its team, if it held one. Null when the socket wasn't a team's — nothing to push. */
  teamDisconnected(
    joinCode: string,
    socketId: string,
  ): Promise<SessionOutcome | null> {
    return this.sessionWrite.write<SessionOutcome | null>(joinCode, (session) =>
      this.rosterChanges.disconnect(session, socketId),
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
    return projectScreen(this.sessionWrite.read(joinCode), room, {
      onBlankScreen: (onAirScreen) =>
        this.logger.warn(
          `Session ${joinCode}: big screen sent blank, content for on-air screen "${onAirScreen.kind}" not found`,
        ),
    });
  }

  /** Both auto-lock deadlines (epoch-ms, or null when none is armed). */
  getDeadlines(joinCode: string): DeadlineChange {
    return deadlinesOf(this.sessionWrite.read(joinCode));
  }

  /** Admin-set/clear the epoch-ms time the break is expected to end — see StateSnapshotPayload.breakEndsAt. */
  breakEndTimeSet(
    joinCode: string,
    breakEndsAt: number | null,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.settingsChanges.breakEndTime(session, breakEndsAt),
    );
  }

  /** Admin-set text-size multiplier for every /display screen except the header — see StateSnapshotPayload.displayTextScale. */
  displayTextScaleSet(
    joinCode: string,
    displayTextScale: number,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.settingsChanges.displayTextScale(session, displayTextScale),
    );
  }

  /** Admin-set mute for the big screen's sounds — see StateSnapshotPayload.isDisplaySoundMuted. */
  displaySoundMutedSet(
    joinCode: string,
    isDisplaySoundMuted: boolean,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.settingsChanges.displaySoundMuted(session, isDisplaySoundMuted),
    );
  }

  /** A showdown guess from `socketId`; checked against the session the write holds, so a guess sent as the reveal starts is counted or refused. */
  submitShowdownGuess(
    joinCode: string,
    payload: SubmitShowdownGuessPayload,
    socketId: string,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.showdownsChanges.guess(session, payload, socketId),
    );
  }

  /** Starts a showdown round for the teams tied for first, read from the session the write holds. Leaves isLeaderboardVisible alone. */
  createShowdownRound(
    joinCode: string,
    payload: CreateShowdownRoundPayload,
  ): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.showdownsChanges.newRound(session, payload),
    );
  }

  /**
   * Merges `partial` over the session's settings, lobby-only, and/or replaces
   * the session's leagues when `leagueIds` is given. The checks run against
   * the session the previous write left, before anything is written.
   */
  async updateSessionSettings(
    joinCode: string,
    partial: Partial<SessionSettings>,
    leagueIds?: number[],
  ): Promise<void> {
    await this.sessionWrite.write(joinCode, (session) =>
      this.leagueChanges.settingsAndLeagues(session, partial, leagueIds),
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
          // Stryker disable next-line StringLiteral: unreachable defensive fallback, every failure on this path is an Error; the text only fills a refusal that is never produced.
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

  /**
   * An admin edits a bonus award's points and reason; refreshes standings.
   * Returns the updated admin view beside the outcome. A refusal carries the
   * bonus service's message; a missing award is a BonusAwardNotFoundRefusal.
   */
  async editBonus(
    joinCode: string,
    awardId: number,
    points: number,
    reason: string | undefined,
  ): Promise<{ outcome: SessionOutcome; award: BonusAwardAdminView }> {
    let award: BonusAwardAdminView | undefined;
    const outcome = await this.sessionWrite.write(joinCode, async (session) => {
      const change = await this.bonusChanges.edit(
        session,
        awardId,
        points,
        reason,
      );
      award = change.award;
      return change;
    });
    // Stryker disable next-line StringLiteral: unreachable defensive branch (BonusChanges.edit returns an award whenever it returns); the text only reaches the server log.
    if (!award) throw new Error('A bonus edit stored no award view');
    return { outcome, award };
  }

  /** An admin deletes a bonus award; refreshes standings. A missing award is a BonusAwardNotFoundRefusal. */
  removeBonus(joinCode: string, awardId: number): Promise<SessionOutcome> {
    return this.sessionWrite.write(joinCode, (session) =>
      this.bonusChanges.remove(session, awardId),
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
