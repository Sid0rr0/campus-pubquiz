import { roomEmitter, type GameServer } from '@/game/socket/game-socket.types';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type SocketRoomName,
} from '@campus-pubquiz/types';
import type { GameStateService } from '@/game/state/game-state.service';

/**
 * Fans a fresh state view out to every room (display/admin/players) for
 * one session — each room is sent its own view, never a shared snapshot — and separately pushes admin-only presenter context (host
 * notes + next-question preview) to the admin room alone. One shared spot
 * for both broadcasts so none of this function's many call sites need a
 * second, easy-to-forget broadcast call. Presenter context is emitted first
 * so STATE_UPDATED — the payload every room actually depends on — is always
 * the most recent emit.
 */
export function broadcastGameState(
  server: GameServer,
  joinCode: string,
  gameState: GameStateService,
): void {
  server
    .to(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))
    .emit(
      SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED,
      gameState.getPresenterContext(joinCode),
    );

  for (const room of Object.values(SOCKET_ROOMS)) {
    sendStateUpdate(server, joinCode, gameState, room);
  }
}

/** One room's own view, sent to that room — typed so no room is sent another's. */
function sendStateUpdate<R extends SocketRoomName>(
  server: GameServer,
  joinCode: string,
  gameState: GameStateService,
  room: R,
): void {
  roomEmitter(server, joinCode, room).emit(
    SOCKET_EVENTS.STATE_UPDATED,
    gameState.getView(joinCode, room),
  );
}
