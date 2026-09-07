import type { Server } from 'socket.io';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
} from '@campus-pubquiz/types';
import type { GameStateService } from '@/game/state/game-state.service';

/**
 * Fans a fresh state snapshot out to every room (display/admin/players) for
 * one session, and separately pushes admin-only presenter context (host
 * notes + next-question preview) to the admin room alone. One shared spot
 * for both broadcasts so none of this function's many call sites need a
 * second, easy-to-forget broadcast call. Presenter context is emitted first
 * so STATE_UPDATED — the payload every room actually depends on — is always
 * the most recent emit.
 */
export function broadcastGameState(
  server: Server,
  joinCode: string,
  gameState: GameStateService,
): void {
  server
    .to(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))
    .emit(
      SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED,
      gameState.getPresenterContext(joinCode),
    );

  server
    .to(sessionRoom(joinCode, SOCKET_ROOMS.DISPLAY))
    .to(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))
    .to(sessionRoom(joinCode, SOCKET_ROOMS.PLAYERS))
    .emit(SOCKET_EVENTS.STATE_UPDATED, gameState.getSnapshot(joinCode));
}
