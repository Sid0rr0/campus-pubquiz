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
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
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

  constructor(private readonly gameState: GameStateService) {}

  async handleConnection(client: Socket): Promise<void> {
    const role = client.handshake.query.role;

    if (typeof role !== 'string' || !VALID_ROOMS.includes(role)) {
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
}
