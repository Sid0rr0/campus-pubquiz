import {
  getActiveBlockStartIndex,
  isLastQuestionBeforeBreak,
  isShowdownEligible,
} from './admin-view-flags';
import { getBlockSeededQuestions } from './block-questions';
import { getFeedbackField } from './feedback-rounds';
import { describeControlAvailability } from './control-availability';
import type { DisplayScreen } from './display-screen';
import type { GameProgress } from './game-state-types';
import { isRevealingStatus } from './game-state-groups';
import { isQuestionHiddenBehindKahootLeaderboard } from './kahoot-visibility';
import { describeLeaderboardBoard } from './leaderboard-board';
import { FULLY_REVEALED_STEP } from './closest-guess-reveal';
import {
  assembleDisplayScreen,
  trimOnAirQuestion,
} from './session-display-screen';
import { revealStepOf } from './stepped-reveal';
import { describeAdvanceStep, describePreviousState } from './move-plan';
import {
  type OnAirScreen,
  describeAdminIndicators,
  describeOnAirScreen,
  describePlayersScreen,
  screenPositionOf,
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
  buildScreenOperatorFields,
  buildSnapshot,
  isBlockAnswerable,
} from './session-snapshot';
import { SOCKET_ROOMS, type SocketRoomName } from './socket-events';

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

/** Hooks the caller can hand the projection; the projection itself stays pure. */
export interface ProjectScreenOptions {
  /** Called when the display view had to send `blank` because the On-air screen's content couldn't be resolved, so the caller can log it. */
  onBlankScreen?: (onAirScreen: OnAirScreen) => void;
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
  options?: ProjectScreenOptions,
): StateViewByRoom[Room];
export function projectScreen(
  session: SessionState,
  audience: SocketRoomName,
  options?: ProjectScreenOptions,
): StateViewByRoom[SocketRoomName] {
  const snapshot = buildSnapshot(session);
  // The closest-guess step stays server-side: it only keys the reveal screen
  // and trims the reveal questions; no view carries it.
  const closestGuessRevealStep = revealStepOf(session, 'closest_guess');
  const { screen, screenKey, header } = describeOnAirScreen({
    ...snapshot,
    closestGuessRevealStep,
  });
  // The Display screen /display is sent. The admin view reads the media the big
  // screen is playing from it, so the two can't disagree.
  const buildDisplayScreen = (): DisplayScreen =>
    assembleDisplayScreen(session, snapshot, screen, closestGuessRevealStep);

  switch (audience) {
    case SOCKET_ROOMS.DISPLAY: {
      const displayScreen = buildDisplayScreen();
      if (displayScreen.kind === 'blank') options?.onBlankScreen?.(screen);
      // The content the Display screen carries is not sent a second time.
      /* eslint-disable @typescript-eslint/no-unused-vars */
      const {
        currentQuestion: _currentQuestion,
        blockQuestions: _blockQuestions,
        revealQuestions: _revealQuestions,
        activeShowdown: _activeShowdown,
        showdownRevealStep: _showdownRevealStep,
        roundTitle: _roundTitle,
        ...shared
      } = snapshot;
      const { breakEndsAt: _breakEndsAt, ...operatorFields } =
        buildScreenOperatorFields(session);
      /* eslint-enable @typescript-eslint/no-unused-vars */
      return {
        ...shared,
        ...operatorFields,
        ...buildDisplayFields(session),
        screen: displayScreen,
        screenKey,
        screenPosition: screenPositionOf(snapshot.progress),
        header,
        leagueTop: session.leagueTop,
      };
    }
    case SOCKET_ROOMS.ADMIN:
      return {
        ...snapshot,
        ...buildScreenOperatorFields(session),
        ...buildAdminFields(session),
        onAirScreen: screen,
        ...describeAdminIndicators(snapshot),
        controlAvailability: describeControlAvailability({
          progress: snapshot.progress,
          leaderboard: snapshot.leaderboard,
          displayScreen: buildDisplayScreen(),
        }),
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
                closestGuessRevealStep,
              ),
      };
      return isQuestionHiddenBehindKahootLeaderboard(session)
        ? { ...view, currentQuestion: null, blockQuestions: [] }
        : view;
    }
  }
}
