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
} from '@campus-pubquiz/types';
import { TeamService } from '../team/team.service';
import { GameStateService } from './game-state.service';

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

  private isValidAdminPassword(client: Socket): boolean {
    const password: unknown = client.handshake.auth.password;
    return (
      typeof password === 'string' &&
      password.length > 0 &&
      password === process.env.ADMIN_PASSWORD
    );
  }
}
