import {
  SOCKET_ROOMS,
  type BlockRevealQuestionView,
  type GameProgress,
  describeAdminIndicators,
  describeOnAirScreen,
  describePlayersScreen,
  type SocketRoomName,
  type StateViewByRoom,
} from '@campus-pubquiz/types';
import {
  getActiveBlockStartIndex,
  isLastQuestionBeforeBreak,
  isShowdownEligible,
} from '@/game/state/admin-view-flags.util';
import {
  describeAdvanceStep,
  describePreviousState,
} from '@/game/state/move-plan.util';
import { isQuestionHiddenBehindKahootLeaderboard } from '@/game/state/kahoot-visibility.util';
import type { SessionState } from '@/game/state/session-state';
import {
  buildSnapshot,
  isBlockAnswerable,
} from '@/game/state/session-snapshot.util';

/**
 * The reveal questions the big screen has shown so far: everything before
 * revealIndex, plus the one at revealIndex once its own 'reveal' step is on
 * air (not during the round's 'reveal_intro' title card). A removal, not a
 * mask — the leaderboard flag doesn't change what has been shown underneath.
 */
function trimToRevealWalk(
  revealQuestions: readonly BlockRevealQuestionView[],
  { status, revealIndex }: GameProgress,
): BlockRevealQuestionView[] {
  const shownCount = status === 'reveal' ? revealIndex + 1 : revealIndex;
  return revealQuestions.slice(0, shownCount);
}

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
        advanceStep: describeAdvanceStep(session),
        previousState: describePreviousState(session),
        activeBlockStartIndex: getActiveBlockStartIndex(session),
        isShowdownEligible: isShowdownEligible(session),
        isLastQuestionBeforeBreak: isLastQuestionBeforeBreak(session),
      };
    case SOCKET_ROOMS.PLAYERS: {
      // The screen fields read the untrimmed block (the reveal_intro card
      // needs the upcoming question's round title); only what leaves the
      // server is trimmed.
      const isAnswerable = isBlockAnswerable(session);
      const view = {
        ...snapshot,
        ...describePlayersScreen({ ...snapshot, isAnswerable }),
        isAnswerable,
        revealQuestions: trimToRevealWalk(
          snapshot.revealQuestions,
          snapshot.progress,
        ),
      };
      return isQuestionHiddenBehindKahootLeaderboard(session)
        ? { ...view, currentQuestion: null, blockQuestions: [] }
        : view;
    }
  }
}
