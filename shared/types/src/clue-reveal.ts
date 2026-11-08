import { clueValue } from './clue-value';
import { isQuestionOnAirStatus } from './game-state-groups';
import type { GameProgress } from './game-state-types';
import { QUESTION_KINDS } from './question-kind';
import type { QuestionView, SeededQuestion } from './question-views';
import type { SessionState } from './session-state';
import type { SteppedRevealDescriptor } from './stepped-reveal';

/** The Clue question being asked under `progress`, if one is on air. */
export function clueQuestionAsked(
  session: SessionState,
  progress: GameProgress,
): SeededQuestion | null {
  if (!isQuestionOnAirStatus(progress.status)) return null;
  const question =
    session.seededGame.rounds[progress.roundIndex]?.questions[
      progress.questionIndex
    ];
  return question && QUESTION_KINDS[question.type].hasClues ? question : null;
}

/** The clue walk as a stepped reveal: one step per clue, falling through at both ends, never waiting on its first Advance. */
export function clueRevealDescriptor(
  question: SeededQuestion,
): SteppedRevealDescriptor {
  return {
    stepCount: question.options?.length ?? 0,
    atStart: 'fall_through',
    atEnd: 'fall_through',
    canStart: true,
  };
}

/** The step the clue walk starts on, whichever way it is landed on: the highest clue shown (the first clue on first opening). */
export function clueStartStep(
  session: SessionState,
  question: SeededQuestion,
): number {
  return Math.max(0, (session.highestClueShown[question.id] ?? 0) - 1);
}

/** The view fields a Clue question carries when `shown` of its clues are on show and `highest` is the highest clue shown. Nothing for other types or before any clue is shown. */
export function clueViewFields(
  question: SeededQuestion,
  shown: number,
  highest: number,
): Pick<QuestionView, 'clues' | 'clueCount' | 'clueValue'> {
  const all = question.options ?? [];
  if (!QUESTION_KINDS[question.type].hasClues || shown === 0) return {};
  return {
    clues: all.slice(0, shown),
    clueCount: all.length,
    clueValue: clueValue(all.length, Math.max(highest, shown)),
  };
}
