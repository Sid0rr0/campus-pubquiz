import {
  SOCKET_ROOMS,
  type SocketRoomName,
  type StateViewByRoom,
} from '@campus-pubquiz/types';
import { isQuestionHiddenBehindKahootLeaderboard } from '@/game/state/kahoot-visibility.util';
import type { SessionState } from '@/game/state/session-state';
import { buildSnapshot } from '@/game/state/session-snapshot.util';

/**
 * The Screen projection: the view of a live session that one audience (a
 * socket room) is sent on every state broadcast and on connect/reconnect.
 * Pure — the display and admin views are the snapshot unchanged; the
 * players view has whatever a team has not been shown yet removed before
 * the payload leaves the server.
 */
export function projectScreen<Room extends SocketRoomName>(
  session: SessionState,
  audience: Room,
): StateViewByRoom[Room];
export function projectScreen(
  session: SessionState,
  audience: SocketRoomName,
): StateViewByRoom[SocketRoomName] {
  const snapshot = buildSnapshot(session);
  if (
    audience === SOCKET_ROOMS.PLAYERS &&
    isQuestionHiddenBehindKahootLeaderboard(session)
  ) {
    return { ...snapshot, currentQuestion: null, blockQuestions: [] };
  }
  return snapshot;
}
