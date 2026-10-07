import {
  getActiveBlockStartIndex,
  isLastQuestionBeforeBreak,
  isShowdownEligible,
} from './admin-view-flags';
import { getBlockSeededQuestions } from './block-questions';
import { getFeedbackField } from './feedback-rounds';
import type { GameProgress } from './game-state-types';
import { isRevealingStatus } from './game-state-groups';
import { isQuestionHiddenBehindKahootLeaderboard } from './kahoot-visibility';
import { describeAdvanceStep, describePreviousState } from './move-plan';
import {
  describeAdminIndicators,
  describeOnAirScreen,
  describePlayersScreen,
} from './on-air-screen';
import type {
  BlockQuestionView,
  BlockRevealQuestionView,
  ClosestGuessRevealData,
  PendingClosestGuessRevealView,
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

// Closest-guess reveal steps (see closest-guess-reveal): each one adds a
// line to the big screen, and the phone is sent each only once it is on air.
const HIGHEST_GUESS_STEP = 2;
const ANSWER_STEP = 3;
const CLOSEST_TEAMS_STEP = 4;

function trimClosestGuessStats(
  stats: ClosestGuessRevealData,
  step: number,
): ClosestGuessRevealData {
  const { minGuess, maxGuess, closestGuesses } = stats;
  return {
    hasSubmissions: true,
    ...(step >= 1 && minGuess !== undefined ? { minGuess } : {}),
    ...(step >= HIGHEST_GUESS_STEP && maxGuess !== undefined
      ? { maxGuess }
      : {}),
    closestGuesses: step >= CLOSEST_TEAMS_STEP ? closestGuesses : [],
  };
}

/** The on-air closest_guess question as the big screen has shown it at `step`; any other question, and one nobody guessed for (a single-step reveal), is returned whole. */
function trimToClosestGuessStep(
  question: BlockRevealQuestionView,
  step: number,
): BlockRevealQuestionView | PendingClosestGuessRevealView {
  const { closestGuess } = question;
  if (!closestGuess?.hasSubmissions || step >= CLOSEST_TEAMS_STEP) {
    return question;
  }
  const trimmedStats = trimClosestGuessStats(closestGuess, step);
  if (step >= ANSWER_STEP) return { ...question, closestGuess: trimmedStats };
  const unshownFields = new Set(['answer', 'answerMediaUrl']);
  const shown = Object.fromEntries(
    Object.entries(question).filter(([field]) => !unshownFields.has(field)),
  ) as BlockQuestionView;
  return { ...shown, closestGuess: trimmedStats };
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
  { status, revealIndex }: GameProgress,
  closestGuessRevealStep: number,
): (BlockRevealQuestionView | PendingClosestGuessRevealView)[] {
  const isOnAirRevealShown = status === 'reveal';
  const shownCount = isOnAirRevealShown ? revealIndex + 1 : revealIndex;
  return revealQuestions
    .slice(0, shownCount)
    .map((question, index) =>
      isOnAirRevealShown && index === revealIndex
        ? trimToClosestGuessStep(question, closestGuessRevealStep)
        : question,
    );
}

/**
 * The final block's reveal walk as it stood when the quiz ended, so a phone
 * that reconnects at 'ended' keeps its answers (the block is in neither
 * revealQuestions nor pastRevealedQuestions by then). Trims by the status the
 * quiz ended from; ending from a status that isn't revealing carries nothing.
 * The on-air question is carried whole — nothing is being revealed any more.
 */
function endedRevealWalk(
  session: SessionState,
): (BlockRevealQuestionView | PendingClosestGuessRevealView)[] {
  const { progress } = session;
  if (!progress.previousStatus || !isRevealingStatus(progress.previousStatus)) {
    return [];
  }
  return trimToRevealWalk(
    getBlockSeededQuestions({
      ...session,
      progress: { ...progress, status: progress.previousStatus },
    }),
    { ...progress, status: progress.previousStatus },
    CLOSEST_TEAMS_STEP,
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
