import {
  getActiveBlockStartIndex,
  isLastQuestionBeforeBreak,
  isShowdownEligible,
} from './admin-view-flags';
import { getBlockSeededQuestions } from './block-questions';
import { getFeedbackField } from './feedback-rounds';
import { describeFunFacts } from './fun-facts';
import type { GameProgress } from './game-state-types';
import { isRevealingStatus } from './game-state-groups';
import { isQuestionHiddenBehindKahootLeaderboard } from './kahoot-visibility';
import { describeLeaderboardBoard } from './leaderboard-board';
import { FULLY_REVEALED_STEP, shownAtStep } from './closest-guess-reveal';
import { describeAdvanceStep, describePreviousState } from './move-plan';
import {
  describeAdminIndicators,
  describeOnAirScreen,
  describePlayersScreen,
} from './on-air-screen';
import type {
  BlockRevealQuestionView,
  PlayersRevealQuestionView,
} from './question-views';
import type { StateViewByRoom } from './room-views';
import type { SessionState } from './session-state';
import {
  buildAdminFields,
  buildDisplayFields,
  buildPlayersFields,
  buildSnapshot,
  isBlockAnswerable,
} from './session-snapshot';
import { SOCKET_ROOMS, type SocketRoomName } from './socket-events';

/** The question on air in 'reveal', shown only as far as its closest-guess step has got; earlier reveal questions, and every question outside 'reveal', are sent whole. */
function trimOnAirQuestion(
  revealQuestions: readonly BlockRevealQuestionView[],
  { status, revealIndex }: GameProgress,
  closestGuessRevealStep: number,
): PlayersRevealQuestionView[] {
  return revealQuestions.map((question, index) =>
    status === 'reveal' && index === revealIndex
      ? shownAtStep(question, closestGuessRevealStep)
      : question,
  );
}

/**
 * The reveal questions the big screen has shown so far: everything before
 * revealIndex, plus the one at revealIndex once its own 'reveal' step is on
 * air (not during the round's 'reveal_intro' title card), shown only as far
 * as its closest-guess step has got. A removal, not a mask — the leaderboard
 * flag doesn't change what has been shown underneath.
 */
function trimToRevealWalk(
  revealQuestions: readonly BlockRevealQuestionView[],
  progress: GameProgress,
  closestGuessRevealStep: number,
): PlayersRevealQuestionView[] {
  const shownCount =
    progress.status === 'reveal'
      ? progress.revealIndex + 1
      : progress.revealIndex;
  return trimOnAirQuestion(
    revealQuestions.slice(0, shownCount),
    progress,
    closestGuessRevealStep,
  );
}

/**
 * The final block's reveal walk as it stood when the quiz ended, so a phone
 * that reconnects at 'ended' keeps its answers (the block is in neither
 * revealQuestions nor pastRevealedQuestions by then). Trims by the status the
 * quiz ended from; ending from a status that isn't revealing carries nothing.
 * The on-air question is carried whole — nothing is being revealed any more.
 */
function endedRevealWalk(session: SessionState): PlayersRevealQuestionView[] {
  const { progress } = session;
  if (!progress.previousStatus || !isRevealingStatus(progress.previousStatus)) {
    return [];
  }
  const endedFrom = { ...progress, status: progress.previousStatus };
  return trimToRevealWalk(
    getBlockSeededQuestions(session, endedFrom),
    endedFrom,
    FULLY_REVEALED_STEP,
  );
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
        ...buildDisplayFields(session),
        revealQuestions: trimOnAirQuestion(
          snapshot.revealQuestions,
          snapshot.progress,
          snapshot.closestGuessRevealStep,
        ),
        onAirScreen: screen,
        screenKey,
        header,
        leaderboardBoard: describeLeaderboardBoard(session),
        funFacts:
          screen.kind === 'break_intro' ? describeFunFacts(session) : [],
      };
    case SOCKET_ROOMS.ADMIN:
      return {
        ...snapshot,
        ...buildAdminFields(session),
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
        ...buildPlayersFields(session),
        phoneLeaderboard: {
          board: describeLeaderboardBoard(session),
          revealCount: session.leaderboardRevealCount,
        },
        ...describePlayersScreen({
          ...snapshot,
          isAnswerable,
          isShowdownResolved: session.activeShowdownRound?.resolved ?? false,
        }),
        isAnswerable,
        feedback: getFeedbackField(session),
        revealQuestions:
          snapshot.progress.status === 'ended'
            ? endedRevealWalk(session)
            : trimToRevealWalk(
                snapshot.revealQuestions,
                snapshot.progress,
                snapshot.closestGuessRevealStep,
              ),
      };
      return isQuestionHiddenBehindKahootLeaderboard(session)
        ? { ...view, currentQuestion: null, blockQuestions: [] }
        : view;
    }
  }
}
