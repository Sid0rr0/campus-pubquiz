import type { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type AuthUser,
  type SocketRoomName,
} from '@campus-pubquiz/types';
import { extractSessionCookie } from '@/auth/session-cookie';
import type { SessionService } from '@/auth/session.service';
import { broadcastGameState } from '@/game/socket/game-broadcast.util';
import type { GameStateService } from '@/game/state/game-state.service';

export const VALID_ROOMS: string[] = [
  SOCKET_ROOMS.DISPLAY,
  SOCKET_ROOMS.ADMIN,
  SOCKET_ROOMS.PLAYERS,
];

export async function resolveAdminUser(
  cookieHeader: string | undefined,
  sessions: SessionService,
): Promise<AuthUser | null> {
  const token = extractSessionCookie(cookieHeader);
  if (!token) return null;
  const validated = await sessions.validate(token);
  return validated?.user ?? null;
}

export async function acceptConnection(
  deps: {
    gameState: GameStateService;
    sessions: SessionService;
    logger: Logger;
  },
  client: Socket,
): Promise<void> {
  const role = client.handshake.query.role;

  if (typeof role !== 'string' || !VALID_ROOMS.includes(role)) {
    deps.logger.warn(
      `Rejected connection ${client.id}: unrecognized role "${String(role)}"`,
    );
    client.disconnect();
    return;
  }

  const requestedCode = client.handshake.query.code;
  if (
    typeof requestedCode !== 'string' ||
    !deps.gameState.hasSession(requestedCode)
  ) {
    deps.logger.warn(
      `Rejected connection ${client.id}: unknown session code "${String(requestedCode)}"`,
    );
    client.emit('exception', 'Unknown game session code');
    client.disconnect();
    return;
  }
  const joinCode = requestedCode;

  if (role === SOCKET_ROOMS.ADMIN) {
    const user = await resolveAdminUser(
      client.handshake.headers.cookie,
      deps.sessions,
    );
    if (!user) {
      deps.logger.warn(
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
  deps.logger.log(
    `Client ${client.id} connected as ${role} (session ${joinCode})`,
  );
  client.emit(SOCKET_EVENTS.STATE_SYNC, deps.gameState.getSnapshot(joinCode));
}

export function disconnectClient(
  deps: { gameState: GameStateService; server: Server; logger: Logger },
  client: Socket,
): void {
  const joinCode = (client.data as { joinCode?: string }).joinCode;
  // The session may have been closed (evicted from memory) while this
  // socket was still connected to it — e.g. the admin who just closed it
  // from within the console disconnecting moments later. Closing already
  // means nothing here needs cleanup.
  if (!joinCode || !deps.gameState.hasSession(joinCode)) return;

  const teamId = deps.gameState.clearTeamConnectionBySocketId(
    joinCode,
    client.id,
  );
  if (!teamId) return;

  deps.logger.log(`Client ${client.id} disconnected, freeing team ${teamId}`);
  broadcastGameState(
    deps.server,
    joinCode,
    deps.gameState.getSnapshot(joinCode),
  );
}
