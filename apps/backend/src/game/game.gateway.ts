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
  type JoinPlayersPayload,
  type StateSnapshotPayload,
  type SubmitAnswerPayload,
} from '@campus-pubquiz/types';
import { TeamService } from '@/team/team.service';
import { AnswerService } from '@/answer/answer.service';
import { GameStateService } from '@/game/game-state.service';

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

  constructor(
    private readonly gameState: GameStateService,
    private readonly teamService: TeamService,
    private readonly answerService: AnswerService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const role = client.handshake.query.role;

    if (typeof role !== 'string' || !VALID_ROOMS.includes(role)) {
      client.disconnect();
      return;
    }

    if (role === SOCKET_ROOMS.ADMIN && !this.isValidAdminPassword(client)) {
      client.disconnect();
      return;
    }

    await client.join(role);
    client.emit(SOCKET_EVENTS.STATE_SYNC, this.gameState.getSnapshot());
  }

  @SubscribeMessage(SOCKET_EVENTS.ADMIN_ACTION)
  handleAdminAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AdminActionPayload,
  ): void {
    if (!client.rooms.has(SOCKET_ROOMS.ADMIN)) {
      throw new WsException('Only admin clients may perform game actions');
    }

    let snapshot: StateSnapshotPayload;
    try {
      snapshot = this.gameState.applyAction(payload.action);
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

    try {
      const team = await this.teamService.join(
        this.gameState.getGameSessionId(),
        payload.teamName,
        payload.teamToken,
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

  private isValidAdminPassword(client: Socket): boolean {
    const password: unknown = client.handshake.auth.password;
    return (
      typeof password === 'string' &&
      password.length > 0 &&
      password === process.env.ADMIN_PASSWORD
    );
  }
}
