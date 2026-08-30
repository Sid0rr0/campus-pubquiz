import {
  getQuizStructureSummary,
  getTimedPhaseKey,
  type AdminQuestionContext,
  type StateSnapshotPayload,
  type TeamView,
} from '@campus-pubquiz/types';
import type { SeededRound } from '@/db/seed.types';
import {
  getAnsweredTeamIds,
  getBlockQuestions,
  getCurrentQuestion,
  getCurrentRoundTitle,
  getPastRevealedQuestions,
  getRevealQuestions,
  getUpcomingQuestionPositions,
} from '@/game/state/block-questions.util';
import { getGameContext, type SessionState } from '@/game/state/session-state';
import { buildActiveShowdownView } from '@/game/state/showdown-reveal.util';

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
  const displayedKey = getTimedPhaseKey(session.progress, getGameContext(session));
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

/** Assembles the full broadcast payload for a session — the shape every display/admin/players client resyncs to on connect or after every applyAction. */
export function buildSnapshot(session: SessionState): StateSnapshotPayload {
  return {
    progress: session.progress,
    quizStructure: getQuizStructureSummary(getGameContext(session)),
    roundTitle: getCurrentRoundTitle(session),
    currentQuestion: getCurrentQuestion(session),
    blockQuestions: getBlockQuestions(session),
    upcomingQuestions: getUpcomingQuestionPositions(session),
    revealQuestions: getRevealQuestions(session),
    pastRevealedQuestions: getPastRevealedQuestions(session),
    ungradedQuestionIds: session.ungradedQuestionIds,
    answeredTeamIds: getAnsweredTeamIds(session),
    leaderboard: session.leaderboard,
    leaderboardRevealCount: session.leaderboardRevealCount,
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
    ...resolveCurrentPhaseTimerView(session),
    settings: session.seededGame.settings,
    activeShowdown: buildActiveShowdownView(
      session.activeShowdownRound,
      session.showdownRevealStep,
    ),
    showdownRevealStep: session.showdownRevealStep,
  };
}

export function isQuestionOpenForAnswering(
  session: SessionState,
  questionId: number,
): boolean {
  return (
    (session.progress.status === 'question_open' ||
      session.progress.status === 'locking' ||
      session.progress.status === 'round_intro') &&
    getBlockQuestions(session).some((question) => question.id === questionId)
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
