import { DEFAULT_MARGIN, type Margin } from './margin';
import { QUESTION_KINDS, type GradingSettingName } from './question-kind';
import type { QuestionType } from './question-types';
import type { MatchScoringMode } from './question-views';

/**
 * The Answer key module: what an answer is graded against. A question's
 * grading settings are optional on every shape that carries them (a stored
 * payload, a draft, a `QuestionView`); this is the one place that fills in
 * the defaults and drops the settings its type doesn't carry, so no consumer
 * defaults an optional field itself. Pure (no I/O).
 */

/** The value of every grading setting, for the types that carry it. */
interface GradingSettingValues {
  matchScoringMode: MatchScoringMode;
  margin: Margin;
}

/** What a question shape may carry of the grading settings, unset or not. */
export type OptionalGradingSettings = {
  [Name in GradingSettingName]?: GradingSettingValues[Name] | null;
};

/** The settings a type carries, resolved (a type carries only some, so the rest are absent). */
export type GradingSettings = Partial<GradingSettingValues>;

/** The slice of a question the settings are read from — `QuestionView` satisfies it. */
export type GradingSettingsSource = OptionalGradingSettings & {
  type: QuestionType;
};

/** What an answer is graded against: the correct answer, the points, and the resolved settings. */
export type AnswerKey = GradingSettings & { answer: string; points: number };

const DEFAULT_SETTINGS: GradingSettingValues = {
  matchScoringMode: 'partial',
  margin: DEFAULT_MARGIN,
};

/** Copies a margin so a key never shares an object with its question. */
function resolveSetting<Name extends GradingSettingName>(
  name: Name,
  stored: GradingSettingValues[Name] | null | undefined,
): GradingSettingValues[Name] {
  const value = stored ?? DEFAULT_SETTINGS[name];
  return typeof value === 'object' ? ({ ...value } as typeof value) : value;
}

/** The type's grading settings with defaults filled in; settings the type doesn't carry are dropped. */
export function gradingSettingsOf(
  question: GradingSettingsSource,
): GradingSettings {
  return Object.fromEntries(
    QUESTION_KINDS[question.type].gradingSettings.map((name) => [
      name,
      resolveSetting(name, question[name]),
    ]),
  );
}

/** The one value a question's answers are graded against. */
export function answerKeyOf(
  question: GradingSettingsSource & { answer: string; points: number },
): AnswerKey {
  return {
    answer: question.answer,
    points: question.points,
    ...gradingSettingsOf(question),
  };
}

/** A key as comparable data: answer, points and settings by value, whatever the order of a margin's fields. */
function comparable(key: AnswerKey): unknown[] {
  return [
    key.answer,
    key.points,
    key.matchScoringMode,
    key.margin?.value,
    key.margin?.unit,
  ];
}

/** Whether two answer keys grade the same: answer, points and settings equal by value. */
export function isSameAnswerKey(a: AnswerKey, b: AnswerKey): boolean {
  return JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));
}
