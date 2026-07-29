import { Logger } from '@nestjs/common';
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
  type GradeAnswerPayload,
  type JoinPlayersPayload,
  type KickTeamPayload,
  type ListAnswersPayload,
  type SelectQuizPayload,
  type StateSnapshotPayload,
  type SubmitAnswerPayload,
} from '@campus-pubquiz/types';
import { TeamService } from '@/team/team.service';
import { AnswerService } from '@/answer/answer.service';
import { GameStateService } from '@/game/game-state.service';
import { QuizService } from '@/quiz/quiz.service';
import { corsOriginValidator } from '@/config/cors.config';

const VALID_ROOMS: string[] = [
  SOCKET_ROOMS.DISPLAY,
  SOCKET_ROOMS.ADMIN,
  SOCKET_ROOMS.PLAYERS,
];

@WebSocketGateway({
  cors: { origin: corsOriginValidator },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly gameState: GameStateService,
    private readonly teamService: TeamService,
    private readonly answerService: AnswerService,
    private readonly quizService: QuizService,
    private readonly orm: MikroORM,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const role = client.handshake.query.role;

    if (typeof role !== 'string' || !VALID_ROOMS.includes(role)) {
      this.logger.warn(
        `Rejected connection ${client.id}: unrecognized role "${String(role)}"`,
      );
      client.disconnect();
      return;
    }

    if (role === SOCKET_ROOMS.ADMIN && !this.isValidAdminPassword(client)) {
      this.logger.warn(
        `Rejected connection ${client.id}: invalid admin password`,
      );
      client.emit('exception', 'Invalid admin password');
      client.disconnect();
      return;
    }

    await client.join(role);
    this.logger.log(`Client ${client.id} connected as ${role}`);
    client.emit(SOCKET_EVENTS.STATE_SYNC, this.gameState.getSnapshot());
  }

  handleDisconnect(client: Socket): void {
    const teamId = this.gameState.clearTeamConnectionBySocketId(client.id);
    if (!teamId) return;

    this.logger.log(`Client ${client.id} disconnected, freeing team ${teamId}`);
    this.server
      .to(SOCKET_ROOMS.DISPLAY)
      .to(SOCKET_ROOMS.ADMIN)
      .to(SOCKET_ROOMS.PLAYERS)
      .emit(SOCKET_EVENTS.STATE_UPDATED, this.gameState.getSnapshot());
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
      this.server
        .to(SOCKET_ROOMS.DISPLAY)
        .to(SOCKET_ROOMS.ADMIN)
        .to(SOCKET_ROOMS.PLAYERS)
        .emit(SOCKET_EVENTS.STATE_UPDATED, this.gameState.getSnapshot());
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
    this.server
      .to(SOCKET_ROOMS.DISPLAY)
      .to(SOCKET_ROOMS.ADMIN)
      .to(SOCKET_ROOMS.PLAYERS)
      .emit(SOCKET_EVENTS.STATE_UPDATED, this.gameState.getSnapshot());
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

    this.server
      .to(SOCKET_ROOMS.DISPLAY)
      .to(SOCKET_ROOMS.ADMIN)
      .to(SOCKET_ROOMS.PLAYERS)
      .emit(SOCKET_EVENTS.STATE_UPDATED, this.gameState.getSnapshot());
  }

  @SubscribeMessage(SOCKET_EVENTS.LIST_QUIZZES)
  @CreateRequestContext()
  async handleListQuizzes(@ConnectedSocket() client: Socket): Promise<void> {
    if (!client.rooms.has(SOCKET_ROOMS.ADMIN)) {
      throw new WsException('Only admin clients may list quizzes');
    }

    this.logger.log(`${SOCKET_EVENTS.LIST_QUIZZES} from ${client.id}`);

    const quizzes = await this.quizService.list();
    client.emit(SOCKET_EVENTS.QUIZZES_LISTED, {
      activeQuizId: this.gameState.getActiveQuizId(),
      quizzes,
    });
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

    this.server
      .to(SOCKET_ROOMS.DISPLAY)
      .to(SOCKET_ROOMS.ADMIN)
      .to(SOCKET_ROOMS.PLAYERS)
      .emit(SOCKET_EVENTS.STATE_UPDATED, snapshot);
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

  private isValidAdminPassword(client: Socket): boolean {
    const password: unknown = client.handshake.auth.password;
    return (
      typeof password === 'string' &&
      password.length > 0 &&
      password === process.env.ADMIN_PASSWORD
    );
  }
}
