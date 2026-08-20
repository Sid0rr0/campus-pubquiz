import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type AnswersUpdatedPayload,
  type GameStatus,
  type SocketRoomName,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import type { AuthUser } from '@campus-pubquiz/types';
import { extractSessionCookie } from '@/auth/session-cookie';
import { SessionService } from '@/auth/session.service';
import { TeamService } from '@/team/team.service';
import { AnswerService } from '@/answer/answer.service';
import { BonusService, InvalidBonusAwardError } from '@/bonus/bonus.service';
import { GameStateService } from '@/game/game-state.service';
import { corsOriginValidator } from '@/config/cors.config';
import {
  adminActionPayloadSchema,
  awardBonusPayloadSchema,
  gradeAnswerPayloadSchema,
  joinPlayersPayloadSchema,
  kickTeamPayloadSchema,
  parseSocketPayload,
  submitAnswerPayloadSchema,
} from '@/game/socket-payload.schemas';

const VALID_ROOMS: string[] = [
  SOCKET_ROOMS.DISPLAY,
  SOCKET_ROOMS.ADMIN,
  SOCKET_ROOMS.PLAYERS,
];

@WebSocketGateway({
  cors: { origin: corsOriginValidator, credentials: true },
})
export class GameGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(GameGateway.name);
  private readonly questionLockTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly gameState: GameStateService,
    private readonly teamService: TeamService,
    private readonly answerService: AnswerService,
    private readonly bonusService: BonusService,
    private readonly sessions: SessionService,
    private readonly orm: MikroORM,
  ) {}

  onModuleDestroy(): void {
    for (const timer of this.questionLockTimers.values()) {
      clearTimeout(timer);
    }
    this.questionLockTimers.clear();
  }

  @CreateRequestContext()
  async handleConnection(client: Socket): Promise<void> {
    const role = client.handshake.query.role;

    if (typeof role !== 'string' || !VALID_ROOMS.includes(role)) {
      this.logger.warn(
        `Rejected connection ${client.id}: unrecognized role "${String(role)}"`,
      );
      client.disconnect();
      return;
    }

    const requestedCode = client.handshake.query.code;
    if (
      typeof requestedCode !== 'string' ||
      !this.gameState.hasSession(requestedCode)
    ) {
      this.logger.warn(
        `Rejected connection ${client.id}: unknown session code "${String(requestedCode)}"`,
      );
      client.emit('exception', 'Unknown game session code');
      client.disconnect();
      return;
    }
    const joinCode = requestedCode;

    if (role === SOCKET_ROOMS.ADMIN) {
      const user = await this.resolveAdminUser(client);
      if (!user) {
        this.logger.warn(
          `Rejected connection ${client.id}: invalid or expired session`,
        );
        client.emit('exception', 'Invalid or expired session');
        client.disconnect();
        return;
      }
      (client.data as { user?: AuthUser }).user = user;
    }

    (client.data as { joinCode?: string }).joinCode = joinCode;
    await client.join(sessionRoom(joinCode, role as SocketRoomName));
    this.logger.log(
      `Client ${client.id} connected as ${role} (session ${joinCode})`,
    );
    client.emit(SOCKET_EVENTS.STATE_SYNC, this.gameState.getSnapshot(joinCode));
  }

  handleDisconnect(client: Socket): void {
    const joinCode = (client.data as { joinCode?: string }).joinCode;
    // The session may have been closed (evicted from memory) while this
    // socket was still connected to it — e.g. the admin who just closed it
    // from within the console disconnecting moments later. Closing already
    // means nothing here needs cleanup.
    if (!joinCode || !this.gameState.hasSession(joinCode)) return;

    const teamId = this.gameState.clearTeamConnectionBySocketId(
      joinCode,
      client.id,
    );
    if (!teamId) return;

    this.logger.log(`Client ${client.id} disconnected, freeing team ${teamId}`);
    this.broadcastState(joinCode, this.gameState.getSnapshot(joinCode));
  }

  /** Every non-connection handler reads the joinCode fixed on this socket at connect time. */
  private resolveJoinCode(client: Socket): string {
    const joinCode = (client.data as { joinCode?: string }).joinCode;
    if (!joinCode) {
      throw new WsException('Connection not associated with a game session');
    }
    return joinCode;
  }

  // Socket.IO events aren't covered by @mikro-orm/nestjs's HTTP-only
  // auto request-context middleware — @CreateRequestContext() forks one.
  @SubscribeMessage(SOCKET_EVENTS.ADMIN_ACTION)
  @CreateRequestContext()
  async handleAdminAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<void> {
    const payload = parseSocketPayload(adminActionPayloadSchema, rawPayload);
    const joinCode = this.resolveJoinCode(client);
    if (!client.rooms.has(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))) {
      throw new WsException('Only admin clients may perform game actions');
    }

    this.logger.log(
      `${SOCKET_EVENTS.ADMIN_ACTION} from ${client.id}: action=${payload.action}`,
    );

    const previousStatus = this.gameState.getSnapshot(joinCode).progress.status;
    let snapshot: StateSnapshotPayload;
    try {
      snapshot = await this.gameState.applyAction(joinCode, payload.action);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid game action';
      throw new WsException(message);
    }

    // The leaderboard otherwise only refreshes on GRADE_ANSWER, so toggling
    // it on before any grading has happened would show nothing — recompute
    // fresh here so every currently-joined team appears, 0 points and all.
    if (
      payload.action === 'TOGGLE_LEADERBOARD' &&
      snapshot.progress.isLeaderboardVisible
    ) {
      const leaderboard = await this.answerService.computeLeaderboard(
        this.gameState.getGameSessionId(joinCode),
      );
      this.gameState.setLeaderboard(joinCode, leaderboard);
      snapshot = this.gameState.getSnapshot(joinCode);
    }

    await this.syncTeamAnswersOnRevealEntry(
      joinCode,
      previousStatus,
      snapshot.progress.status,
    );

    this.broadcastState(joinCode, snapshot);
    this.rearmQuestionLockTimer(joinCode);
  }

  /**
   * Fires when the last question of a breakAfter round has been open for
   * the session's settings.lockGraceSeconds with no admin action —
   * auto-advances exactly as if the admin had clicked "Advance" themselves.
   */
  @CreateRequestContext()
  private async handleQuestionLockTimerExpired(
    joinCode: string,
  ): Promise<void> {
    this.questionLockTimers.delete(joinCode);

    const previousStatus = this.gameState.getSnapshot(joinCode).progress.status;
    let snapshot: StateSnapshotPayload;
    try {
      snapshot = await this.gameState.applyAction(joinCode, 'ADVANCE');
    } catch (error) {
      this.logger.error(
        `Auto-lock ADVANCE failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }

    await this.syncTeamAnswersOnRevealEntry(
      joinCode,
      previousStatus,
      snapshot.progress.status,
    );

    this.broadcastState(joinCode, snapshot);
    this.rearmQuestionLockTimer(joinCode);
  }

  /**
   * Pushes each currently-connected team its own up-to-date graded answers
   * the moment the block they answered first reaches 'reveal_intro' — by
   * then every answer should be graded (auto-graded at submit, or manually
   * by the admin sometime during the break screens beforehand), so this is
   * the one moment a connected team's local state needs refreshing to show
   * accurate points once reveal renders them. Fires once per entry into
   * reveal, not on every ADVANCE while already revealing.
   */
  private async syncTeamAnswersOnRevealEntry(
    joinCode: string,
    previousStatus: GameStatus,
    newStatus: GameStatus,
  ): Promise<void> {
    if (previousStatus === 'reveal_intro' || newStatus !== 'reveal_intro') {
      return;
    }

    const gameSessionId = this.gameState.getGameSessionId(joinCode);
    const { teams } = this.gameState.getSnapshot(joinCode);
    for (const team of teams) {
      if (!team.isConnected) continue;
      const socketId = this.gameState.getConnectedSocketId(
        joinCode,
        team.teamId,
      );
      if (!socketId) continue;
      const answers = await this.answerService.listForTeam(
        gameSessionId,
        team.teamId,
      );
      this.server
        .to(socketId)
        .emit(SOCKET_EVENTS.TEAM_ANSWERS_SYNCED, { answers });
    }
  }

  /** (Re)arms this session's auto-lock timer to match GameStateService's current deadline, clearing any stale one first. */
  private rearmQuestionLockTimer(joinCode: string): void {
    const existing = this.questionLockTimers.get(joinCode);
    if (existing) {
      clearTimeout(existing);
      this.questionLockTimers.delete(joinCode);
    }

    const lockAt = this.gameState.getQuestionLockAt(joinCode);
    if (lockAt === null) return;

    const delay = Math.max(0, lockAt - Date.now());
    this.questionLockTimers.set(
      joinCode,
      setTimeout(() => {
        void this.handleQuestionLockTimerExpired(joinCode);
      }, delay),
    );
  }

  private broadcastState(
    joinCode: string,
    snapshot: StateSnapshotPayload,
  ): void {
    this.server
      .to(sessionRoom(joinCode, SOCKET_ROOMS.DISPLAY))
      .to(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))
      .to(sessionRoom(joinCode, SOCKET_ROOMS.PLAYERS))
      .emit(SOCKET_EVENTS.STATE_UPDATED, snapshot);
  }

  /**
   * Called by SessionsController once it has evicted a session (`DELETE
   * /sessions/:joinCode`) — the in-memory session is already gone by this
   * point, so any player still connected to it would otherwise only find out
   * on its next action, as an opaque "Unknown game session" error. Scoped to
   * the players room alone: the closing admin already navigates away via its
   * own REST response, and /display has no redirect target of its own yet.
   */
  notifySessionClosed(joinCode: string): void {
    this.server
      .to(sessionRoom(joinCode, SOCKET_ROOMS.PLAYERS))
      .emit(SOCKET_EVENTS.SESSION_CLOSED, { joinCode });
  }

  /**
   * Called by SessionsController once it has persisted new settings (`PATCH
   * /sessions/:joinCode/settings`) — a full state re-broadcast (unlike
   * notifySessionClosed's narrow one-off emit) so /display, /admin, and
   * /rules?code= all pick up the change immediately.
   */
  notifySettingsUpdated(joinCode: string): void {
    this.broadcastState(joinCode, this.gameState.getSnapshot(joinCode));
  }

  @SubscribeMessage(SOCKET_EVENTS.JOIN_PLAYERS)
  @CreateRequestContext()
  async handleJoinPlayers(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<void> {
    const payload = parseSocketPayload(joinPlayersPayloadSchema, rawPayload);
    const joinCode = this.resolveJoinCode(client);
    if (!client.rooms.has(sessionRoom(joinCode, SOCKET_ROOMS.PLAYERS))) {
      throw new WsException('Only player clients may join a team');
    }

    this.logger.log(
      `${SOCKET_EVENTS.JOIN_PLAYERS} from ${client.id}: teamName=${payload.teamName}`,
    );

    try {
      const team = await this.teamService.join(
        this.gameState.getGameSessionId(joinCode),
        payload.teamName,
        {
          teamToken: payload.teamToken,
          teamCode: payload.teamCode,
          joinCode: payload.joinCode,
        },
      );

      const existingSocketId = this.gameState.getConnectedSocketId(
        joinCode,
        team.id,
      );
      const isLiveElsewhere =
        existingSocketId &&
        existingSocketId !== client.id &&
        this.server.sockets.sockets.get(existingSocketId)?.connected;
      if (isLiveElsewhere) {
        throw new WsException(
          `"${team.name}" is already connected on another device — ask the quiz master to remove it, then try again.`,
        );
      }
      this.gameState.setTeamConnected(joinCode, team.id, client.id);

      const savedAnswers = await this.answerService.listForTeam(
        this.gameState.getGameSessionId(joinCode),
        team.id,
      );
      client.emit(SOCKET_EVENTS.JOIN_ACCEPTED, {
        teamId: team.id,
        teamName: team.name,
        teamToken: team.token,
        teamCode: team.code,
        answers: savedAnswers,
      });

      const teams = await this.teamService.listForSession(
        this.gameState.getGameSessionId(joinCode),
      );
      this.gameState.setTeams(joinCode, teams);
      this.broadcastState(joinCode, this.gameState.getSnapshot(joinCode));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to join';
      throw new WsException(message);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SUBMIT_ANSWER)
  @CreateRequestContext()
  async handleSubmitAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<void> {
    const payload = parseSocketPayload(submitAnswerPayloadSchema, rawPayload);
    const joinCode = this.resolveJoinCode(client);
    if (!client.rooms.has(sessionRoom(joinCode, SOCKET_ROOMS.PLAYERS))) {
      throw new WsException('Only player clients may submit answers');
    }

    this.logger.log(
      `${SOCKET_EVENTS.SUBMIT_ANSWER} from ${client.id}: questionId=${payload.questionId} teamId=${payload.teamId}`,
    );

    if (
      !this.gameState.isQuestionOpenForAnswering(joinCode, payload.questionId)
    ) {
      throw new WsException('Answers are locked for this question');
    }

    if (
      this.gameState.getConnectedSocketId(joinCode, payload.teamId) !==
      client.id
    ) {
      throw new WsException('You may only submit answers for your own team');
    }

    const submitted = await this.answerService.submit(
      this.gameState.getGameSessionId(joinCode),
      payload.questionId,
      payload.teamId,
      payload.value,
    );

    client.emit(SOCKET_EVENTS.ANSWER_RECEIVED, {
      questionId: payload.questionId,
      teamId: submitted.teamId,
      teamName: submitted.teamName,
      value: submitted.value,
      pointsAwarded: submitted.pointsAwarded,
      gradedAt: submitted.gradedAt,
    });

    const answers = await this.answerService.listForQuestion(
      this.gameState.getGameSessionId(joinCode),
      payload.questionId,
    );
    this.server
      .to(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))
      .emit(
        SOCKET_EVENTS.ANSWERS_UPDATED,
        this.buildAnswersUpdatedPayload(joinCode, payload.questionId, answers),
      );

    this.gameState.setAnsweredTeamIds(
      joinCode,
      payload.questionId,
      answers.map((answer) => answer.teamId),
    );
    this.gameState.setQuestionGradedStatus(
      joinCode,
      payload.questionId,
      answers.some((answer) => answer.gradedAt === null),
    );
    this.broadcastState(joinCode, this.gameState.getSnapshot(joinCode));
  }

  @SubscribeMessage(SOCKET_EVENTS.GRADE_ANSWER)
  @CreateRequestContext()
  async handleGradeAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<void> {
    const payload = parseSocketPayload(gradeAnswerPayloadSchema, rawPayload);
    const joinCode = this.resolveJoinCode(client);
    if (!client.rooms.has(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))) {
      throw new WsException('Only admin clients may grade answers');
    }

    this.logger.log(
      `${SOCKET_EVENTS.GRADE_ANSWER} from ${client.id}: answerId=${payload.answerId} pointsAwarded=${payload.pointsAwarded}`,
    );

    const gameSessionId = this.gameState.getGameSessionId(joinCode);

    let questionId: number;
    try {
      ({ questionId } = await this.answerService.grade(
        gameSessionId,
        payload.answerId,
        payload.pointsAwarded,
      ));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to grade answer';
      throw new WsException(message);
    }

    const answers = await this.answerService.listForQuestion(
      gameSessionId,
      questionId,
    );
    this.server
      .to(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))
      .emit(
        SOCKET_EVENTS.ANSWERS_UPDATED,
        this.buildAnswersUpdatedPayload(joinCode, questionId, answers),
      );

    const leaderboard =
      await this.answerService.computeLeaderboard(gameSessionId);
    this.gameState.setLeaderboard(joinCode, leaderboard);
    this.gameState.setQuestionGradedStatus(
      joinCode,
      questionId,
      answers.some((answer) => answer.gradedAt === null),
    );

    this.broadcastState(joinCode, this.gameState.getSnapshot(joinCode));
  }

  @SubscribeMessage(SOCKET_EVENTS.KICK_TEAM)
  @CreateRequestContext()
  async handleKickTeam(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<void> {
    const payload = parseSocketPayload(kickTeamPayloadSchema, rawPayload);
    const joinCode = this.resolveJoinCode(client);
    if (!client.rooms.has(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))) {
      throw new WsException('Only admin clients may remove a team');
    }

    this.logger.log(
      `${SOCKET_EVENTS.KICK_TEAM} from ${client.id}: teamId=${payload.teamId}`,
    );

    const socketId = this.gameState.getConnectedSocketId(
      joinCode,
      payload.teamId,
    );
    if (socketId) {
      const targetSocket = this.server.sockets.sockets.get(socketId);
      targetSocket?.emit(SOCKET_EVENTS.TEAM_KICKED);
      targetSocket?.disconnect(true);
      this.gameState.clearTeamConnectionBySocketId(joinCode, socketId);
    }

    // Kicking removes the team from this session's roster outright — a
    // disconnected team has no live socket to boot, so disconnection alone
    // (the old behavior) was a no-op for it.
    const gameSessionId = this.gameState.getGameSessionId(joinCode);
    await this.teamService.removeFromRoster(gameSessionId, payload.teamId);

    const teams = await this.teamService.listForSession(gameSessionId);
    this.gameState.setTeams(joinCode, teams);
    this.broadcastState(joinCode, this.gameState.getSnapshot(joinCode));
  }

  @SubscribeMessage(SOCKET_EVENTS.AWARD_BONUS)
  @CreateRequestContext()
  async handleAwardBonus(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<void> {
    const payload = parseSocketPayload(awardBonusPayloadSchema, rawPayload);
    const joinCode = this.resolveJoinCode(client);
    if (!client.rooms.has(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))) {
      throw new WsException('Only admin clients may award bonus points');
    }

    this.logger.log(
      `${SOCKET_EVENTS.AWARD_BONUS} from ${client.id}: teamId=${payload.teamId} category=${payload.category} points=${payload.points}`,
    );

    try {
      await this.bonusService.award(
        this.gameState.getGameSessionId(joinCode),
        payload.teamId,
        payload.category,
        payload.points,
        payload.reason,
        this.gameState.getSessionSettings(joinCode).enabledBonusCategories,
        this.gameState.getSessionSettings(joinCode).maxBonusAwardsPerCategory,
      );
    } catch (error) {
      if (error instanceof InvalidBonusAwardError) {
        throw new WsException(error.message);
      }
      throw error;
    }

    const leaderboard = await this.answerService.computeLeaderboard(
      this.gameState.getGameSessionId(joinCode),
    );
    this.gameState.setLeaderboard(joinCode, leaderboard);
    this.broadcastState(joinCode, this.gameState.getSnapshot(joinCode));
  }

  private buildAnswersUpdatedPayload(
    joinCode: string,
    questionId: number,
    answers: AnswersUpdatedPayload['answers'],
  ): AnswersUpdatedPayload {
    const question = this.gameState.getAdminQuestionContext(
      joinCode,
      questionId,
    );
    if (!question) {
      throw new WsException(`Unknown question ${questionId}`);
    }
    return { questionId, question, answers };
  }

  private async resolveAdminUser(client: Socket): Promise<AuthUser | null> {
    const token = extractSessionCookie(client.handshake.headers.cookie);
    if (!token) return null;
    const validated = await this.sessions.validate(token);
    return validated?.user ?? null;
  }
}
