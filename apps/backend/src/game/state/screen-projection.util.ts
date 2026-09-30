import {
  SOCKET_ROOMS,
  describeAdminIndicators,
  describeOnAirScreen,
  describePlayersScreen,
  type SocketRoomName,
  type StateViewByRoom,
} from '@campus-pubquiz/types';
import {
  getActionAvailability,
  getActiveBlockStartIndex,
} from '@/game/state/action-availability.util';
import { isQuestionHiddenBehindKahootLeaderboard } from '@/game/state/kahoot-visibility.util';
import type { SessionState } from '@/game/state/session-state';
import {
  buildSnapshot,
  isBlockAnswerable,
} from '@/game/state/session-snapshot.util';

/**
 * The Screen projection: the view of a live session that one audience (a
 * socket room) is sent on every state broadcast and on connect/reconnect.
 * Pure — every view is the snapshot plus what that audience needs computed;
 * the players view also has whatever a team has not been shown yet removed
 * before the payload leaves the server.
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
  const { screen, screenKey, header } = describeOnAirScreen(snapshot);

  switch (audience) {
    case SOCKET_ROOMS.DISPLAY:
      return {
        ...snapshot,
        onAirScreen: screen,
        screenKey,
        header,
        // The next kahoot question is already open underneath the board.
        isBetweenKahootQuestions:
          session.progress.status === 'question_open' &&
          isQuestionHiddenBehindKahootLeaderboard(session),
      };
    case SOCKET_ROOMS.ADMIN:
      return {
        ...snapshot,
        onAirScreen: screen,
        ...describeAdminIndicators(snapshot),
        ...getActionAvailability(session),
        activeBlockStartIndex: getActiveBlockStartIndex(session),
      };
    case SOCKET_ROOMS.PLAYERS: {
      const view = {
        ...snapshot,
        ...describePlayersScreen(snapshot),
        isAnswerable: isBlockAnswerable(session),
      };
      return isQuestionHiddenBehindKahootLeaderboard(session)
        ? { ...view, currentQuestion: null, blockQuestions: [] }
        : view;
    }
  }
}
