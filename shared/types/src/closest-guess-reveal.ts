import type { AnswerView } from './answers';
import { getBlockInPlayIds } from './block-in-play';
import {
  getBlockStartPosition,
  getRoundAndQuestionForBlockPosition,
} from './game-state-block-position';
import type { GameProgress } from './game-state-types';
import type {
  BlockRevealQuestionView,
  ClosestGuessRevealData,
  PlayersRevealQuestionView,
  SeededQuestion,
} from './question-views';
import { toBlockQuestionView } from './question-view-conversions';
import { QUESTION_KINDS } from './question-kind';
import { findClosestGuesses } from './scoring';
import { getGameContext, type SessionState } from './session-state';
import type { SteppedRevealDescriptor } from './stepped-reveal';

/**
 * Summarizes a closest_guess question's answers into the display/play-facing
 * reveal shape. The closest team(s) are the numerically closest guesses to
 * `correctAnswer` — not the rows with points, since the quiz master may override a
 * grade without changing who was actually closest.
 */
export function summarizeClosestGuess(
  correctAnswer: string,
  answers: AnswerView[],
): ClosestGuessRevealData {
  const numeric = answers
    .map((answer) => ({ ...answer, parsed: Number(answer.value) }))
    .filter((answer) => Number.isFinite(answer.parsed));
  if (numeric.length === 0)
    return { hasSubmissions: false, closestGuesses: [] };
  const min = numeric.reduce((m, a) => (a.parsed < m.parsed ? a : m));
  const max = numeric.reduce((m, a) => (a.parsed > m.parsed ? a : m));
  const isClosest = findClosestGuesses(
    correctAnswer,
    answers.map(({ value }) => value),
  );
  return {
    hasSubmissions: true,
    minGuess: min.value,
    maxGuess: max.value,
    closestGuesses: answers
      .filter((_, index) => isClosest[index])
      .map(({ teamName, value }) => ({ teamName, value })),
  };
}

/** Resolves the seeded question a block-relative revealIndex points at, given the (roundIndex, questionIndex) the block is currently pinned to. */
function getRevealTargetQuestion(
  session: SessionState,
  roundIndex: number,
  questionIndex: number,
  revealIndex: number,
): SeededQuestion | undefined {
  const context = getGameContext(session);
  const blockStart = getBlockStartPosition(roundIndex, questionIndex, context);
  const { roundIndex: targetRound, questionIndex: targetQuestion } =
    getRoundAndQuestionForBlockPosition(blockStart, revealIndex, context);
  // Stryker disable next-line OptionalChaining: equivalent, the only caller checks revealIndex against the block size first, so the target always exists
  return session.seededGame.rounds[targetRound]?.questions[targetQuestion];
}

/**
 * The reveal lines in the order they go on air, after the question-only
 * step 0: step N shows the first N lines. Each step keeps everything shown at
 * the previous step and adds one more line, it never replaces.
 */
const REVEAL_LINES = [
  'minGuess',
  'maxGuess',
  'answer',
  'closestGuesses',
] as const;

type RevealLine = (typeof REVEAL_LINES)[number];

/** The step with every line on air: the last step of a question someone guessed on. */
export const FULLY_REVEALED_STEP = REVEAL_LINES.length;

const isLineShownAt = (line: RevealLine, step: number): boolean =>
  REVEAL_LINES.indexOf(line) < step;

/**
 * How many reveal sub-steps this question has: the question-only step plus one
 * per reveal line when someone guessed. Every other type, and closest_guess
 * with zero submissions, is one step (question + answer together immediately).
 */
function getRevealStepCount(
  question: SeededQuestion | undefined,
  session: SessionState,
): number {
  if (!question || QUESTION_KINDS[question.type].revealKind !== 'closest_guess')
    return 1;
  const summary = session.closestGuessSummaries[question.id];
  return summary?.hasSubmissions ? FULLY_REVEALED_STEP + 1 : 1;
}

function statsShownAt(
  stats: ClosestGuessRevealData,
  step: number,
): ClosestGuessRevealData {
  const { minGuess, maxGuess, closestGuesses } = stats;
  return {
    hasSubmissions: true,
    ...(isLineShownAt('minGuess', step) && minGuess !== undefined
      ? { minGuess }
      : {}),
    ...(isLineShownAt('maxGuess', step) && maxGuess !== undefined
      ? { maxGuess }
      : {}),
    ...(isLineShownAt('closestGuesses', step) && closestGuesses !== undefined
      ? { closestGuesses }
      : {}),
  };
}

/**
 * The reveal question as the room sees it at `step`. Before the answer step a
 * closest_guess question is `closest_guess_pending` (no answer, no answer
 * media); from it on it is `closest_guess`; in both only the stats lines
 * reached so far are present. A question nobody guessed on, and every other
 * kind, is returned whole at every step.
 */
export function shownAtStep(
  question: BlockRevealQuestionView,
  step: number,
): PlayersRevealQuestionView {
  if (
    question.revealKind !== 'closest_guess' ||
    !question.closestGuess.hasSubmissions
  ) {
    return question;
  }
  const closestGuess = statsShownAt(question.closestGuess, step);
  if (isLineShownAt('answer', step)) return { ...question, closestGuess };
  return {
    ...toBlockQuestionView(question),
    revealKind: 'closest_guess_pending',
    closestGuess,
  };
}

/** The closest-guess reveal as a stepped reveal when `progress` puts a question someone guessed on on air; null otherwise (one step, nothing to walk). It falls through at both ends and has no guard. */
export function closestGuessRevealDescriptor(
  session: SessionState,
  progress: GameProgress,
): SteppedRevealDescriptor | null {
  if (progress.status !== 'reveal') return null;
  // A reveal index past the block names no question: nothing to walk.
  const blockSize = getBlockInPlayIds(
    session.seededGame.rounds,
    progress,
  ).length;
  if (progress.revealIndex >= blockSize) return null;
  const question = getRevealTargetQuestion(
    session,
    progress.roundIndex,
    progress.questionIndex,
    progress.revealIndex,
  );
  const stepCount = getRevealStepCount(question, session);
  if (stepCount <= 1) return null;
  return {
    stepCount,
    atStart: 'fall_through',
    atEnd: 'fall_through',
    canStart: true,
  };
}
