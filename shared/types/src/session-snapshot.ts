import { getBlockInPlayIds } from './block-in-play';
import {
  getAnsweredTeamIds,
  getBlockQuestions,
  getCurrentQuestion,
  getCurrentRoundTitle,
  getPastRevealedQuestions,
  getRevealQuestions,
  getUpcomingQuestionPositions,
} from './block-questions';
import { isAnsweringStatus } from './game-state-groups';
import { getQuizStructureSummary } from './game-state-structure';
import { getTimedPhaseKey } from './game-state-timed-phase';
import { isQuestionHiddenBehindKahootLeaderboard } from './kahoot-visibility';
import type {
  AdminQuestionContext,
  AdminStatePayload,
  DisplayStatePayload,
  PlayersStatePayload,
  StateSnapshotPayload,
  TeamView,
} from './room-views';
import {
  getGameContext,
  type SeededRound,
  type SessionState,
} from './session-state';
import { buildActiveShowdownView } from './showdown-reveal';

/**
 * The phaseStartedAt/phaseElapsedMs pair for whatever timed phase is
 * *currently displayed* (session.progress) — which may not be the live
 * frontier (session.livePhaseKey) if the admin has stepped back via
 * Previous. Displaying the frontier itself is live (phaseStartedAt set,
 * ticking); displaying anything else timed is a fixed, already-banked value
 * (see SessionState.phaseElapsedByKey); displaying an untimed status is
 * neither.
 */
function resolveCurrentPhaseTimerView(session: SessionState): {
  phaseStartedAt: number | null;
  phaseElapsedMs: number | null;
} {
  const displayedKey = getTimedPhaseKey(
    session.progress,
    getGameContext(session),
  );
  if (displayedKey === null) {
    return { phaseStartedAt: null, phaseElapsedMs: null };
  }
  if (displayedKey === session.livePhaseKey) {
    return { phaseStartedAt: session.phaseStartedAt, phaseElapsedMs: null };
  }
  return {
    phaseStartedAt: null,
    phaseElapsedMs: session.phaseElapsedByKey[displayedKey] ?? null,
  };
}

/** The fields only /display reads — added to its view alone by the Screen projection. */
export function buildDisplayFields(
  session: SessionState,
): Pick<
  DisplayStatePayload,
  | 'roundCategory'
  | 'roundAuthor'
  | 'roundCategories'
  | 'roundAuthors'
  | 'leaderboardRevealCount'
  | 'kahootQuestionEndsAt'
> {
  const { rounds } = session.seededGame;
  const currentRound = rounds[session.progress.roundIndex];
  return {
    roundCategory: currentRound?.category ?? '',
    roundAuthor: currentRound?.author ?? '',
    roundCategories: rounds.map((round) => round.category ?? ''),
    roundAuthors: rounds.map((round) => round.author ?? ''),
    leaderboardRevealCount: session.leaderboardRevealCount,
    kahootQuestionEndsAt: session.kahootQuestionEndsAt,
  };
}

/** The fields only /control and /remote read — added to the admin view alone. */
export function buildAdminFields(
  session: SessionState,
): Pick<
  AdminStatePayload,
  'ungradedQuestionIds' | 'phaseStartedAt' | 'phaseElapsedMs'
> {
  return {
    ungradedQuestionIds: session.ungradedQuestionIds,
    ...resolveCurrentPhaseTimerView(session),
  };
}

/** The fields only /play reads — added to the players view alone. */
export function buildPlayersFields(
  session: SessionState,
): Pick<PlayersStatePayload, 'upcomingQuestions' | 'pastRevealedQuestions'> {
  return {
    upcomingQuestions: getUpcomingQuestionPositions(session),
    pastRevealedQuestions: getPastRevealedQuestions(session),
  };
}

/** Assembles the shared base of every room's view for a session — the shape every display/admin/players client resyncs to on connect or after every applyAction. */
export function buildSnapshot(session: SessionState): StateSnapshotPayload {
  return {
    progress: session.progress,
    quizStructure: getQuizStructureSummary(getGameContext(session)),
    roundTitle: getCurrentRoundTitle(session),
    isCurrentRoundKahoot:
      session.seededGame.rounds[session.progress.roundIndex]?.kahootMode ??
      false,
    roundTitles: session.seededGame.rounds.map((round) => round.title),
    currentQuestion: getCurrentQuestion(session),
    blockQuestions: getBlockQuestions(session),
    revealQuestions: getRevealQuestions(session),
    answeredTeamIds: getAnsweredTeamIds(session),
    leaderboard: session.leaderboard,
    joinCode: session.seededGame.joinCode,
    teams: session.teams.map(
      (team): TeamView => ({
        ...team,
        isConnected: Boolean(session.connectedTeamSockets[team.teamId]),
      }),
    ),
    questionLockAt: session.questionLockAt,
    closestGuessRevealStep: session.closestGuessRevealStep,
    breakEndsAt: session.breakEndsAt,
    displayTextScale: session.displayTextScale,
    settings: session.seededGame.settings,
    activeShowdown: buildActiveShowdownView(
      session.activeShowdownRound,
      session.showdownRevealStep,
    ),
    showdownRevealStep: session.showdownRevealStep,
  };
}

/**
 * Whether the session's current block can be answered right now: its
 * questions are open (or locking), or a round intro sits over questions
 * already open — and never for a kahoot question still hidden behind the
 * leaderboard. The one rule behind both the players view and the
 * answer-submission gate.
 */
export function isBlockAnswerable(session: SessionState): boolean {
  return (
    isAnsweringStatus(session.progress.status) &&
    !isQuestionHiddenBehindKahootLeaderboard(session) &&
    getBlockInPlayIds(session.seededGame.rounds, session.progress).length > 0
  );
}

export function isQuestionOpenForAnswering(
  session: SessionState,
  questionId: number,
): boolean {
  return (
    isBlockAnswerable(session) &&
    getBlockInPlayIds(session.seededGame.rounds, session.progress).includes(
      questionId,
    )
  );
}

/**
 * Correct answer + round position for a question, for the admin grading
 * view alone. Callers MUST only forward this over an admin-room-only
 * channel (ANSWERS_UPDATED) — never through the broadcast snapshot.
 */
export function buildAdminQuestionContext(
  rounds: SeededRound[],
  questionId: number,
): AdminQuestionContext | null {
  for (const [roundOffset, round] of rounds.entries()) {
    const questionOffset = round.questions.findIndex(
      (question) => question.id === questionId,
    );
    if (questionOffset === -1) continue;

    const question = round.questions[questionOffset];
    return {
      type: question.type,
      prompt: question.prompt,
      ...(question.options !== undefined ? { options: question.options } : {}),
      ...(question.matchTargets !== undefined
        ? { matchTargets: question.matchTargets }
        : {}),
      ...(question.mediaUrl !== undefined
        ? { mediaUrl: question.mediaUrl }
        : {}),
      points: question.points,
      correctAnswer: question.answer,
      roundTitle: round.title,
      roundNumber: roundOffset + 1,
      questionNumberInRound: questionOffset + 1,
      totalQuestionsInRound: round.questions.length,
    };
  }
  return null;
}
