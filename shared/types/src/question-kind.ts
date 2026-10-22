import type { z } from 'zod';
import { QUESTION_TYPES, type QuestionType } from './question-types';
import {
  closestGuessPreviewSchema,
  freeTextPreviewSchema,
  matchPreviewSchema,
  multipleChoicePreviewSchema,
  numberPreviewSchema,
  sortPreviewSchema,
} from './question-preview-schema';
import {
  closestGuessPayloadSchema,
  freeTextPayloadSchema,
  matchPayloadSchema,
  multipleChoicePayloadSchema,
  numberPayloadSchema,
  sortPayloadSchema,
  type QuestionPayload,
} from './question-payload-schema';
import {
  answerOnlyCsv,
  choicesCsv,
  matchCsv,
  sortCsv,
  type QuestionCsvCodec,
} from './question-csv-codec';

/** How a type's answers are graded: at submit, in one batch after lock, or by the quiz master. */
/**
 * 'auto' grades every submission at submit; 'batch' grades all together once
 * the question locks; 'match-or-human' grades a submission matching the key
 * correct at submit and leaves any other to the moderator.
 */
export type GradingMode = 'auto' | 'batch' | 'match-or-human';

/** A grading setting a question type may carry: a match question's scoring mode, a Number question's margin (see margin.ts). */
export type GradingSettingName = 'matchScoringMode' | 'margin';

/** Which answer input a type renders on the phone, and which editor section holds its answer. */
export type AnswerInputKind = 'text' | 'number' | 'choice' | 'sort' | 'match';

/**
 * Everything the app knows about one question type. Entries are plain data
 * (no I/O); `QUESTION_KINDS` is keyed by every `QuestionType`, so a type
 * without an entry is a compile error rather than a crash live on stage.
 */
export interface QuestionKind<T extends QuestionType = QuestionType> {
  type: T;
  /** The name the quiz editor's type picker shows. */
  label: string;
  /** One moderator-facing sentence for the `/guide` page: how to author the question and how it is graded. */
  moderatorNote: string;
  inputKind: AnswerInputKind;
  /** The one validation for an ImportQuestionPreview — import (via `decodeSheetRow`) and draft save both use it. */
  schema: z.ZodType;
  /** The payload codec: stored JSON is parsed against this (via `parseQuestionPayload`), never cast. */
  payload: z.ZodType<QuestionPayload>;
  /** How the question's options and answer map to and from the sheet's `options`/`answer` cells. */
  csv: QuestionCsvCodec;
  gradingMode: GradingMode;
  /** Its own field, never derived from `gradingMode`: free_text grades itself on a match but is excluded (ADR 0001). */
  kahootAllowed: boolean;
  /** How the reveal shows the question: its answer, or the step-by-step closest-guess reveal. Its own field, never derived from `gradingMode`. */
  revealKind: 'answer' | 'closest_guess';
  /** Which per-type grading settings the question carries beyond its answer and points (see answer-key.ts). */
  gradingSettings: readonly GradingSettingName[];
  /** Whether a correct rate means anything: false for a one-winner type, whose rate says nothing about how hard it was. Its own field, never derived from `gradingMode`. */
  hasCorrectRate: boolean;
  /**
   * What the Night brief says about a question's wrong answers: the most common
   * typed ones, every option with its pick count, the spread of guesses, or
   * nothing (long answer chains would bury the useful data).
   */
  briefWrongAnswers: 'typed' | 'options' | 'spread' | 'none';
}

export const QUESTION_KINDS: {
  readonly [T in QuestionType]: QuestionKind<T>;
} = {
  free_text: {
    type: 'free_text',
    hasCorrectRate: true,
    briefWrongAnswers: 'typed',
    revealKind: 'answer',
    label: 'Free text',
    moderatorNote:
      'No options. An answer matching the answer text (case and whitespace are ignored) is graded correct when a team submits; any other answer waits for you to grade it, and you can override any mark by hand.',
    inputKind: 'text',
    schema: freeTextPreviewSchema,
    payload: freeTextPayloadSchema,
    csv: answerOnlyCsv,
    gradingMode: 'match-or-human',
    kahootAllowed: false,
    gradingSettings: [],
  },
  multiple_choice: {
    type: 'multiple_choice',
    hasCorrectRate: true,
    briefWrongAnswers: 'options',
    revealKind: 'answer',
    label: 'Multiple choice',
    moderatorNote:
      'Options are separated by pipes (Paris|London|Berlin) and the answer must match one option exactly. Graded automatically when a team submits; you can override by hand.',
    inputKind: 'choice',
    schema: multipleChoicePreviewSchema,
    payload: multipleChoicePayloadSchema,
    csv: choicesCsv,
    gradingMode: 'auto',
    kahootAllowed: true,
    gradingSettings: [],
  },
  sort: {
    type: 'sort',
    hasCorrectRate: true,
    briefWrongAnswers: 'none',
    revealKind: 'answer',
    label: 'Sort / order',
    moderatorNote:
      'Options are pipe-separated in any order and the answer lists them in the correct order. Graded automatically when a team submits; you can override by hand.',
    inputKind: 'sort',
    schema: sortPreviewSchema,
    payload: sortPayloadSchema,
    csv: sortCsv,
    gradingMode: 'auto',
    kahootAllowed: true,
    gradingSettings: [],
  },
  match: {
    type: 'match',
    hasCorrectRate: true,
    briefWrongAnswers: 'none',
    revealKind: 'answer',
    label: 'Match pairs',
    moderatorNote:
      'Options hold both lists as left1|left2+right1|right2 and the answer pairs them (Paris+France|Tokyo+Japan). Graded automatically when a team submits; you can override by hand.',
    inputKind: 'match',
    schema: matchPreviewSchema,
    payload: matchPayloadSchema,
    csv: matchCsv,
    gradingMode: 'auto',
    kahootAllowed: true,
    gradingSettings: ['matchScoringMode'],
  },
  closest_guess: {
    type: 'closest_guess',
    hasCorrectRate: false,
    briefWrongAnswers: 'spread',
    revealKind: 'closest_guess',
    label: 'Closest guess',
    moderatorNote:
      'The answer is a number. Graded in one batch once the block locks: every team tied for the closest guess gets full points and everyone else gets zero. From then on you can override any mark by hand.',
    inputKind: 'number',
    schema: closestGuessPreviewSchema,
    payload: closestGuessPayloadSchema,
    csv: answerOnlyCsv,
    gradingMode: 'batch',
    kahootAllowed: false,
    gradingSettings: [],
  },
  number: {
    type: 'number',
    hasCorrectRate: true,
    briefWrongAnswers: 'typed',
    revealKind: 'answer',
    label: 'Number',
    moderatorNote:
      'The answer is a number, and the question carries a margin (10% of the answer unless the editor says otherwise). An answer within the margin, edges included, is graded correct when a team submits; anything else is graded incorrect. Teams answer on a number keypad, and you can override any mark by hand.',
    inputKind: 'number',
    schema: numberPreviewSchema,
    payload: numberPayloadSchema,
    csv: answerOnlyCsv,
    gradingMode: 'auto',
    kahootAllowed: true,
    gradingSettings: ['margin'],
  },
};

export interface QuestionIssue {
  path: PropertyKey[];
  /** Zod issue code; 'custom' marks a cross-field refinement. */
  code: string;
  message: string;
}

export type QuestionCheck =
  | { success: true; data: unknown }
  | { success: false; issues: QuestionIssue[] };

/** Validates a question-shaped candidate with its kind's schema; an unknown or missing type is an issue on `type`, never a throw. */
export function checkQuestion(candidate: { type?: unknown }): QuestionCheck {
  const type = candidate.type;
  if (!(QUESTION_TYPES as readonly unknown[]).includes(type)) {
    return {
      success: false,
      issues: [
        {
          path: ['type'],
          code: 'invalid_value',
          message: `Unknown question type — expected one of: ${QUESTION_TYPES.join(', ')}`,
        },
      ],
    };
  }
  const parsed =
    QUESTION_KINDS[type as QuestionType].schema.safeParse(candidate);
  return parsed.success
    ? { success: true, data: parsed.data }
    : {
        success: false,
        issues: parsed.error.issues.map(({ path, code, message }) => ({
          path,
          code,
          message,
        })),
      };
}

/**
 * Parses a question's stored JSON payload with its kind's codec. Throws an
 * Error naming the type and the offending fields, so a malformed or old row
 * fails when it is loaded, not midway through a live game.
 */
export function parseQuestionPayload(
  type: QuestionType,
  stored: unknown,
): QuestionPayload {
  const parsed = QUESTION_KINDS[type].payload.safeParse(stored);
  if (parsed.success) return parsed.data;
  const problems = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || '(payload)'}: ${issue.message}`)
    .join('; ');
  throw new Error(`Stored ${type} payload is malformed — ${problems}`);
}
