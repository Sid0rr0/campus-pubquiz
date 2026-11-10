import { isNonAnswer } from './answers';
import { clueValue } from './clue-value';
import { QUESTION_KINDS } from './question-kind';
import type { QuestionType } from './question-types';

/**
 * The Clue answer module: the rules for a team's answer to a Clue question,
 * pure so the server (and later the phone) read one source.
 */

/** What a right answer locked in on clue `clue` (1-based) of `clueCount` is worth. */
export function clueWorth(clueCount: number, clue: number): number {
  return clueValue(clueCount, clue);
}

/**
 * The clue a write is recorded on (null for any type without clues), or
 * 'frozen' when a new clue has been shown since the stored answer was locked
 * in. An unchanged value keeps its clue; a changed one takes the highest clue
 * shown. A stored blank or "I don't know" never freezes, so a team can clear
 * its answer to wait for a later clue. A missing highest clue reads as clue 1.
 */
export function clueToRecord(
  question: { type: QuestionType },
  existing: { value: string; clue: number | null } | null,
  value: string,
  highestClueShown: number | null,
): number | null | 'frozen' {
  if (!QUESTION_KINDS[question.type].hasClues) return null;
  const highest = highestClueShown ?? 1;
  if (existing === null) return highest;
  const stored = existing.clue ?? highest;
  if (existing.value === value) return stored;
  if (stored < highest && !isNonAnswer(existing.value)) return 'frozen';
  return highest;
}
