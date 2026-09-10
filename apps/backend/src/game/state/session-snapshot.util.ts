import {
  getQuizStructureSummary,
  getTimedPhaseKey,
  type AdminQuestionContext,
  type PresenterContextPayload,
  type RevealQuestionView,
  type StateSnapshotPayload,
  type TeamView,
} from '@campus-pubquiz/types';
import type { SeededRound } from '@/db/seed.types';
import {
  getAnsweredTeamIds,
  getBlockQuestions,
  getCurrentQuestion,
  getCurrentRoundTitle,
  getFurthestOpenPosition,
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

/** Assembles the full broadcast payload for a session — the shape every display/admin/players client resyncs to on connect or after every applyAction. */
export function buildSnapshot(session: SessionState): StateSnapshotPayload {
  return {
    progress: session.progress,
    quizStructure: getQuizStructureSummary(getGameContext(session)),
    roundTitle: getCurrentRoundTitle(session),
    roundTitles: session.seededGame.rounds.map((round) => round.title),
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
    displayTextScale: session.displayTextScale,
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
 * The question immediately after (roundIndex, questionIndex) — walking
 * forward into subsequent rounds when the given position is a round's last
 * question, so a presenter on a round's final question still sees a
 * preview instead of "nothing queued". Null only once nothing at all is
 * left in the quiz.
 */
function getQuestionAfter(
  rounds: SeededRound[],
  roundIndex: number,
  questionIndex: number,
): RevealQuestionView | null {
  let currentRoundIndex = roundIndex;
  let nextQuestionIndex = questionIndex + 1;
  while (currentRoundIndex < rounds.length) {
    const round = rounds[currentRoundIndex];
    if (nextQuestionIndex < round.questions.length) {
      return round.questions[nextQuestionIndex];
    }
    currentRoundIndex += 1;
    nextQuestionIndex = 0;
  }
  return null;
}

/**
 * Host notes for the open question + a preview of the next question, for
 * the /remote presenter view alone. Callers MUST only forward this over an
 * admin-room-only channel (PRESENTER_CONTEXT_UPDATED) — never through the
 * broadcast snapshot.
 */
export function buildPresenterContext(
  session: SessionState,
): PresenterContextPayload {
  const currentQuestion = getCurrentQuestion(session);
  const currentRound = session.seededGame.rounds[session.progress.roundIndex];
  const currentQuestionNotes =
    currentQuestion && currentRound
      ? (currentRound.questionNotesById?.[currentQuestion.id] ?? null)
      : null;

  const target = getFurthestOpenPosition(session);
  const nextQuestion = getQuestionAfter(
    session.seededGame.rounds,
    target.roundIndex,
    target.questionIndex,
  );

  return { currentQuestionNotes, nextQuestion };
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
