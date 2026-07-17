import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
  type OnGatewayConnection,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type AdminActionPayload,
  type GradeAnswerPayload,
  type JoinPlayersPayload,
  type SelectQuizPayload,
  type StateSnapshotPayload,
  type SubmitAnswerPayload,
} from '@campus-pubquiz/types';
import { TeamService } from '@/team/team.service';
import { AnswerService } from '@/answer/answer.service';
import { GameStateService } from '@/game/game-state.service';
import { QuizService } from '@/quiz/quiz.service';

const VALID_ROOMS: string[] = [
  SOCKET_ROOMS.DISPLAY,
  SOCKET_ROOMS.ADMIN,
  SOCKET_ROOMS.PLAYERS,
];

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:8888' },
})
export class GameGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly gameState: GameStateService,
    private readonly teamService: TeamService,
    private readonly answerService: AnswerService,
    private readonly quizService: QuizService,
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

  @SubscribeMessage(SOCKET_EVENTS.ADMIN_ACTION)
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
        { teamToken: payload.teamToken, joinCode: payload.joinCode },
      );
      client.emit(SOCKET_EVENTS.JOIN_ACCEPTED, {
        teamId: team.id,
        teamName: team.name,
        teamToken: team.token,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to join';
      throw new WsException(message);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SUBMIT_ANSWER)
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
    this.server.to(SOCKET_ROOMS.ADMIN).emit(SOCKET_EVENTS.ANSWERS_UPDATED, {
      questionId: payload.questionId,
      answers,
    });
  }

  @SubscribeMessage(SOCKET_EVENTS.GRADE_ANSWER)
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
    this.server.to(SOCKET_ROOMS.ADMIN).emit(SOCKET_EVENTS.ANSWERS_UPDATED, {
      questionId,
      answers,
    });

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

  private isValidAdminPassword(client: Socket): boolean {
    const password: unknown = client.handshake.auth.password;
    return (
      typeof password === 'string' &&
      password.length > 0 &&
      password === process.env.ADMIN_PASSWORD
    );
  }
}
