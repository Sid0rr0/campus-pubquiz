import {
  getBlockStartRoundIndex,
  getRoundAndQuestionForBlockPosition,
  type AnswerView,
  type ClosestGuessRevealData,
  type GameAction,
  type GameProgress,
  type RevealQuestionView,
} from '@campus-pubquiz/types';
import { getGameContext, type SessionState } from '@/game/state/session-state';

/** Summarizes a graded closest_guess question's answers into the display/play-facing reveal shape — pointsAwarded > 0 reliably identifies the tied-closest rows, since gradeClosestGuess awards full points to exactly those rows and 0 to everyone else. */
export function summarizeClosestGuess(
  answers: AnswerView[],
): ClosestGuessRevealData {
  const numeric = answers
    .map((answer) => ({ ...answer, parsed: Number(answer.value) }))
    .filter((answer) => Number.isFinite(answer.parsed));
  if (numeric.length === 0)
    return { hasSubmissions: false, closestGuesses: [] };
  const min = numeric.reduce((m, a) => (a.parsed < m.parsed ? a : m));
  const max = numeric.reduce((m, a) => (a.parsed > m.parsed ? a : m));
  return {
    hasSubmissions: true,
    minGuess: min.value,
    maxGuess: max.value,
    closestGuesses: answers
      .filter((answer) => answer.pointsAwarded > 0)
      .map((answer) => ({ teamName: answer.teamName, value: answer.value })),
  };
}

/** Resolves the seeded question a block-relative revealIndex points at, given roundIndex. */
export function getRevealTargetQuestion(
  session: SessionState,
  roundIndex: number,
  revealIndex: number,
): RevealQuestionView | undefined {
  const context = getGameContext(session);
  const blockStart = getBlockStartRoundIndex(roundIndex, context);
  const { roundIndex: targetRound, questionIndex } =
    getRoundAndQuestionForBlockPosition(blockStart, revealIndex, context);
  return session.seededGame.rounds[targetRound]?.questions[questionIndex];
}

/**
 * How many reveal sub-steps this question has. closest_guess with
 * submissions gets 5, cumulatively building up on one screen: (0) just the
 * question, (1) +smallest guess, (2) +highest guess, (3) +correct answer,
 * (4) +closest team(s) — each step keeps everything shown at the previous
 * step and adds one more line, it never replaces. Every other type, and
 * closest_guess with zero submissions, keeps today's single-shot behavior
 * (1 step: question + answer together immediately).
 */
export function getRevealStepCount(
  question: RevealQuestionView | undefined,
  session: SessionState,
): number {
  if (!question || question.type !== 'closest_guess') return 1;
  const summary = session.closestGuessSummaries[question.id];
  return summary?.hasSubmissions ? 5 : 1;
}

/** ADVANCE/PREVIOUS while mid-sequence on the current reveal question — null when there's nothing to gate (not closest_guess, single-step, or already at a boundary), signaling the caller to fall through to getNextGameState. */
export function tryStepClosestGuessReveal(
  session: SessionState,
  action: 'ADVANCE' | 'PREVIOUS',
): SessionState | null {
  const question = getRevealTargetQuestion(
    session,
    session.progress.roundIndex,
    session.progress.revealIndex,
  );
  const totalSteps = getRevealStepCount(question, session);
  if (totalSteps <= 1) return null;

  const step = session.closestGuessRevealStep;
  if (action === 'ADVANCE' && step < totalSteps - 1) {
    return { ...session, closestGuessRevealStep: step + 1 };
  }
  if (action === 'PREVIOUS' && step > 0) {
    return { ...session, closestGuessRevealStep: step - 1 };
  }
  return null;
}

/** Initializes the step counter whenever a (possibly new) question lands on 'reveal': 0 arriving forward (ADVANCE), last step arriving backward (PREVIOUS) — mirrors how PREVIOUS already resumes any other type fully revealed. */
export function computeInitialRevealStep(
  session: SessionState,
  progress: GameProgress,
  action: GameAction,
): number {
  if (progress.status !== 'reveal') return 0;
  const question = getRevealTargetQuestion(
    session,
    progress.roundIndex,
    progress.revealIndex,
  );
  const totalSteps = getRevealStepCount(question, session);
  return action === 'PREVIOUS' ? totalSteps - 1 : 0;
}
