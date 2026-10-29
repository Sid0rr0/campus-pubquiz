import { WsException } from '@nestjs/websockets';
import type { GameSocket } from '@/game/socket/game-socket.types';

/** Events one connection may send per window. A person tapping through a quiz night sends a handful a minute; this only stops a script. */
export const MAX_EVENTS_PER_WINDOW = 60;
export const EVENT_WINDOW_MS = 10_000;

/**
 * Counts one incoming event against its connection's window and refuses it
 * once the window is full, so a script cannot flood a session's write queue
 * and stall every other team in it. Every event counts, a malformed one too.
 *
 * Per connection, not per IP: behind the host's proxy the client IP is not
 * known to be trustworthy here, and limiting a shared address would lock a
 * whole venue out. A script can still open more connections.
 */
export function countEventAgainstLimit(client: GameSocket): void {
  const now = Date.now();
  const window = client.data.eventWindow;
  if (!window || now - window.startedAt >= EVENT_WINDOW_MS) {
    client.data.eventWindow = { startedAt: now, count: 1 };
    return;
  }
  window.count += 1;
  if (window.count > MAX_EVENTS_PER_WINDOW) {
    throw new WsException('Too many requests — slow down and try again');
  }
}
