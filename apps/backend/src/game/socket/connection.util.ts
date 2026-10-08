import type { Logger } from '@nestjs/common';
import { socketOfRoom, type GameSocket } from '@/game/socket/game-socket.types';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type AuthUser,
  type SocketRoomName,
} from '@campus-pubquiz/types';
import { extractSessionCookie } from '@/auth/session-cookie';
import type { SessionService } from '@/auth/session.service';
import {
  deliverOutcome,
  type OutcomeDeliveryDeps,
} from '@/game/socket/outcome-delivery.util';
import type { GameStateService } from '@/game/state/game-state.service';
import type { SessionOutcome } from '@/game/state/session-outcome';

const VALID_ROOMS: string[] = [
  SOCKET_ROOMS.DISPLAY,
  SOCKET_ROOMS.ADMIN,
  SOCKET_ROOMS.PLAYERS,
];

async function resolveAdminUser(
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
  client: GameSocket,
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
  syncState(client, deps.gameState, joinCode, role as SocketRoomName);
  // Otherwise an admin socket that connects (or reconnects) mid-session —
  // e.g. /remote opened well after the last admin action — would show no
  // notes/next-question preview at all until the next action happens to
  // trigger broadcastGameState's admin-room broadcast.
  if (role === SOCKET_ROOMS.ADMIN) {
    client.emit(
      SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED,
      deps.gameState.getPresenterContext(joinCode),
    );
  }
}

/** Sends the connecting socket its own room's view — the same one a live update would carry. */
function syncState<R extends SocketRoomName>(
  client: GameSocket,
  gameState: GameStateService,
  joinCode: string,
  room: R,
): void {
  socketOfRoom<R>(client).emit(
    SOCKET_EVENTS.STATE_SYNC,
    gameState.getView(joinCode, room),
  );
}

export async function disconnectClient(
  deps: OutcomeDeliveryDeps & { logger: Logger },
  client: GameSocket,
): Promise<void> {
  const joinCode = (client.data as { joinCode?: string }).joinCode;
  // The session may have been closed (evicted from memory) while this
  // socket was still connected to it — e.g. the admin who just closed it
  // from within the console disconnecting moments later. Closing already
  // means nothing here needs cleanup.
  if (!joinCode || !deps.gameState.hasSession(joinCode)) return;

  let outcome: SessionOutcome | null;
  try {
    outcome = await deps.gameState.teamDisconnected(joinCode, client.id);
  } catch (error) {
    // The session was closed while this write waited its turn — nothing left to clean up.
    if (!deps.gameState.hasSession(joinCode)) return;
    throw error;
  }
  if (!outcome) return;

  deps.logger.log(`Client ${client.id} disconnected, freeing its team`);
  await deliverOutcome(deps, joinCode, outcome);
}
