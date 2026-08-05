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
  type AdminActionPayload,
  type AnswersUpdatedPayload,
  type AwardBonusPayload,
  type GradeAnswerPayload,
  type JoinPlayersPayload,
  type KickTeamPayload,
  type ListAnswersPayload,
  type SelectQuizPayload,
  type StateSnapshotPayload,
  type SubmitAnswerPayload,
} from '@campus-pubquiz/types';
import type { AuthUser } from '@campus-pubquiz/types';
import { extractSessionCookie } from '@/auth/session-cookie';
import { SessionService } from '@/auth/session.service';
import { TeamService } from '@/team/team.service';
import { AnswerService } from '@/answer/answer.service';
import { BonusService, InvalidBonusAwardError } from '@/bonus/bonus.service';
import { GameStateService } from '@/game/game-state.service';
import { corsOriginValidator } from '@/config/cors.config';

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
  private questionLockTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly gameState: GameStateService,
    private readonly teamService: TeamService,
    private readonly answerService: AnswerService,
    private readonly bonusService: BonusService,
    private readonly sessions: SessionService,
    private readonly orm: MikroORM,
  ) {}

  onModuleDestroy(): void {
    if (this.questionLockTimer) {
      clearTimeout(this.questionLockTimer);
      this.questionLockTimer = null;
    }
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

    await client.join(role);
    this.logger.log(`Client ${client.id} connected as ${role}`);
    client.emit(SOCKET_EVENTS.STATE_SYNC, this.gameState.getSnapshot());
  }

  handleDisconnect(client: Socket): void {
    const teamId = this.gameState.clearTeamConnectionBySocketId(client.id);
    if (!teamId) return;

    this.logger.log(`Client ${client.id} disconnected, freeing team ${teamId}`);
    this.broadcastState(this.gameState.getSnapshot());
  }

  // Socket.IO events aren't covered by @mikro-orm/nestjs's HTTP-only
  // auto request-context middleware — @CreateRequestContext() forks one.
  @SubscribeMessage(SOCKET_EVENTS.ADMIN_ACTION)
  @CreateRequestContext()
  async handleAdminAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AdminActionPayload,
  ): Promise<void> {
    if (!client.rooms.has(SOCKET_ROOMS.ADMIN)) {
      throw new WsException('Only admin clients may perform game actions');
    }

    this.logger.log(
      `${SOCKET_EVENTS.ADMIN_ACTION} from ${client.id}: action=${payload.action}`,
    );

    let snapshot: StateSnapshotPayload;
    try {
      snapshot = await this.gameState.applyAction(payload.action);
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
        this.gameState.getGameSessionId(),
      );
      this.gameState.setLeaderboard(leaderboard);
      snapshot = this.gameState.getSnapshot();
    }

    this.broadcastState(snapshot);
    this.rearmQuestionLockTimer();
  }

  /**
   * Fires when the last question of a breakAfter round has been open for
   * QUESTION_LOCK_DURATION_MS with no admin action — auto-advances exactly
   * as if the admin had clicked "Advance" themselves.
   */
  @CreateRequestContext()
  private async handleQuestionLockTimerExpired(): Promise<void> {
    this.questionLockTimer = null;

    let snapshot: StateSnapshotPayload;
    try {
      snapshot = await this.gameState.applyAction('ADVANCE');
    } catch (error) {
      this.logger.error(
        `Auto-lock ADVANCE failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }

    this.broadcastState(snapshot);
    this.rearmQuestionLockTimer();
  }

  /** (Re)arms the auto-lock timer to match GameStateService's current deadline, clearing any stale one first. */
  private rearmQuestionLockTimer(): void {
    if (this.questionLockTimer) {
      clearTimeout(this.questionLockTimer);
      this.questionLockTimer = null;
    }

    const lockAt = this.gameState.getQuestionLockAt();
    if (lockAt === null) return;

    const delay = Math.max(0, lockAt - Date.now());
    this.questionLockTimer = setTimeout(() => {
      void this.handleQuestionLockTimerExpired();
    }, delay);
  }

  private broadcastState(snapshot: StateSnapshotPayload): void {
    this.server
      .to(SOCKET_ROOMS.DISPLAY)
      .to(SOCKET_ROOMS.ADMIN)
      .to(SOCKET_ROOMS.PLAYERS)
      .emit(SOCKET_EVENTS.STATE_UPDATED, snapshot);
  }

  @SubscribeMessage(SOCKET_EVENTS.JOIN_PLAYERS)
  @CreateRequestContext()
  async handleJoinPlayers(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinPlayersPayload,
  ): Promise<void> {
    if (!client.rooms.has(SOCKET_ROOMS.PLAYERS)) {
      throw new WsException('Only player clients may join a team');
    }

    this.logger.log(
      `${SOCKET_EVENTS.JOIN_PLAYERS} from ${client.id}: teamName=${payload.teamName}`,
    );

    try {
      const team = await this.teamService.join(
        this.gameState.getGameSessionId(),
        payload.teamName,
        {
          teamToken: payload.teamToken,
          teamCode: payload.teamCode,
          joinCode: payload.joinCode,
        },
      );

      const existingSocketId = this.gameState.getConnectedSocketId(team.id);
      const isLiveElsewhere =
        existingSocketId &&
        existingSocketId !== client.id &&
        this.server.sockets.sockets.get(existingSocketId)?.connected;
      if (isLiveElsewhere) {
        throw new WsException(
          `"${team.name}" is already connected on another device — ask the quiz master to remove it, then try again.`,
        );
      }
      this.gameState.setTeamConnected(team.id, client.id);

      const savedAnswers = await this.answerService.listForTeam(
        this.gameState.getGameSessionId(),
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
        this.gameState.getGameSessionId(),
      );
      this.gameState.setTeams(teams);
      this.broadcastState(this.gameState.getSnapshot());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to join';
      throw new WsException(message);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SUBMIT_ANSWER)
  @CreateRequestContext()
  async handleSubmitAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubmitAnswerPayload,
  ): Promise<void> {
    if (!client.rooms.has(SOCKET_ROOMS.PLAYERS)) {
      throw new WsException('Only player clients may submit answers');
    }

    this.logger.log(
      `${SOCKET_EVENTS.SUBMIT_ANSWER} from ${client.id}: questionId=${payload.questionId} teamId=${payload.teamId}`,
    );

    if (!this.gameState.isQuestionOpenForAnswering(payload.questionId)) {
      throw new WsException('Answers are locked for this question');
    }

    const submitted = await this.answerService.submit(
      this.gameState.getGameSessionId(),
      payload.questionId,
      payload.teamId,
      payload.value,
    );

    client.emit(SOCKET_EVENTS.ANSWER_RECEIVED, {
      questionId: payload.questionId,
      teamId: submitted.teamId,
      teamName: submitted.teamName,
      value: submitted.value,
    });

    const answers = await this.answerService.listForQuestion(
      this.gameState.getGameSessionId(),
      payload.questionId,
    );
    this.server
      .to(SOCKET_ROOMS.ADMIN)
      .emit(
        SOCKET_EVENTS.ANSWERS_UPDATED,
        this.buildAnswersUpdatedPayload(payload.questionId, answers),
      );

    this.gameState.setAnsweredTeamIds(
      payload.questionId,
      answers.map((answer) => answer.teamId),
    );
    this.broadcastState(this.gameState.getSnapshot());
  }

  @SubscribeMessage(SOCKET_EVENTS.GRADE_ANSWER)
  @CreateRequestContext()
  async handleGradeAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: GradeAnswerPayload,
  ): Promise<void> {
    if (!client.rooms.has(SOCKET_ROOMS.ADMIN)) {
      throw new WsException('Only admin clients may grade answers');
    }

    this.logger.log(
      `${SOCKET_EVENTS.GRADE_ANSWER} from ${client.id}: answerId=${payload.answerId} pointsAwarded=${payload.pointsAwarded}`,
    );

    const { questionId } = await this.answerService.grade(
      payload.answerId,
      payload.pointsAwarded,
    );

    const gameSessionId = this.gameState.getGameSessionId();

    const answers = await this.answerService.listForQuestion(
      gameSessionId,
      questionId,
    );
    this.server
      .to(SOCKET_ROOMS.ADMIN)
      .emit(
        SOCKET_EVENTS.ANSWERS_UPDATED,
        this.buildAnswersUpdatedPayload(questionId, answers),
      );

    const leaderboard =
      await this.answerService.computeLeaderboard(gameSessionId);
    this.gameState.setLeaderboard(leaderboard);

    this.broadcastState(this.gameState.getSnapshot());
  }

  @SubscribeMessage(SOCKET_EVENTS.SELECT_QUIZ)
  @CreateRequestContext()
  async handleSelectQuiz(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SelectQuizPayload,
  ): Promise<void> {
    if (!client.rooms.has(SOCKET_ROOMS.ADMIN)) {
      throw new WsException('Only admin clients may select a quiz');
    }

    this.logger.log(
      `${SOCKET_EVENTS.SELECT_QUIZ} from ${client.id}: quizId=${payload.quizId}`,
    );

    let snapshot: StateSnapshotPayload;
    try {
      snapshot = await this.gameState.selectQuiz(payload.quizId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to select quiz';
      throw new WsException(message);
    }

    this.broadcastState(snapshot);
    this.rearmQuestionLockTimer();
  }

  @SubscribeMessage(SOCKET_EVENTS.LIST_ANSWERS)
  @CreateRequestContext()
  async handleListAnswers(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ListAnswersPayload,
  ): Promise<void> {
    if (!client.rooms.has(SOCKET_ROOMS.ADMIN)) {
      throw new WsException('Only admin clients may list answers');
    }

    this.logger.log(
      `${SOCKET_EVENTS.LIST_ANSWERS} from ${client.id}: questionId=${payload.questionId}`,
    );

    const answers = await this.answerService.listForQuestion(
      this.gameState.getGameSessionId(),
      payload.questionId,
    );
    client.emit(
      SOCKET_EVENTS.ANSWERS_UPDATED,
      this.buildAnswersUpdatedPayload(payload.questionId, answers),
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.KICK_TEAM)
  handleKickTeam(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: KickTeamPayload,
  ): void {
    if (!client.rooms.has(SOCKET_ROOMS.ADMIN)) {
      throw new WsException('Only admin clients may remove a team');
    }

    this.logger.log(
      `${SOCKET_EVENTS.KICK_TEAM} from ${client.id}: teamId=${payload.teamId}`,
    );

    const socketId = this.gameState.getConnectedSocketId(payload.teamId);
    const targetSocket = socketId
      ? this.server.sockets.sockets.get(socketId)
      : undefined;
    if (!targetSocket) return;

    targetSocket.emit(
      'exception',
      'You were removed from this team by the quiz master',
    );
    targetSocket.disconnect(true);
  }

  @SubscribeMessage(SOCKET_EVENTS.AWARD_BONUS)
  @CreateRequestContext()
  async handleAwardBonus(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AwardBonusPayload,
  ): Promise<void> {
    if (!client.rooms.has(SOCKET_ROOMS.ADMIN)) {
      throw new WsException('Only admin clients may award bonus points');
    }

    this.logger.log(
      `${SOCKET_EVENTS.AWARD_BONUS} from ${client.id}: teamId=${payload.teamId} category=${payload.category} points=${payload.points}`,
    );

    try {
      await this.bonusService.award(
        this.gameState.getGameSessionId(),
        payload.teamId,
        payload.category,
        payload.points,
        payload.reason,
      );
    } catch (error) {
      if (error instanceof InvalidBonusAwardError) {
        throw new WsException(error.message);
      }
      throw error;
    }

    const leaderboard = await this.answerService.computeLeaderboard(
      this.gameState.getGameSessionId(),
    );
    this.gameState.setLeaderboard(leaderboard);
    this.broadcastState(this.gameState.getSnapshot());
  }

  private buildAnswersUpdatedPayload(
    questionId: number,
    answers: AnswersUpdatedPayload['answers'],
  ): AnswersUpdatedPayload {
    const question = this.gameState.getAdminQuestionContext(questionId);
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
