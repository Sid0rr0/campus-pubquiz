import type { Server } from 'socket.io';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';

/** Fans a fresh state snapshot out to every room (display/admin/players) for one session. */
export function broadcastGameState(
  server: Server,
  joinCode: string,
  snapshot: StateSnapshotPayload,
): void {
  server
    .to(sessionRoom(joinCode, SOCKET_ROOMS.DISPLAY))
    .to(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))
    .to(sessionRoom(joinCode, SOCKET_ROOMS.PLAYERS))
    .emit(SOCKET_EVENTS.STATE_UPDATED, snapshot);
}
