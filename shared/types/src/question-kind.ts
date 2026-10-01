import type { z } from 'zod';
import { QUESTION_TYPES, type QuestionType } from './question-types';
import {
  audioPreviewSchema,
  closestGuessPreviewSchema,
  freeTextPreviewSchema,
  matchPreviewSchema,
  multipleChoicePreviewSchema,
  sortPreviewSchema,
  youtubePreviewSchema,
} from './question-preview-schema';
import {
  audioPayloadSchema,
  closestGuessPayloadSchema,
  freeTextPayloadSchema,
  matchPayloadSchema,
  multipleChoicePayloadSchema,
  sortPayloadSchema,
  youtubePayloadSchema,
  type QuestionPayload,
} from './question-payload-schema';
import {
  answerOnlyCsv,
  choicesCsv,
  matchCsv,
  sortCsv,
  type QuestionCsvCodec,
} from './question-csv-codec';
import { youtubeClipNotes, type ClipNotesCodec } from './youtube';

/** How a type's answers are graded: at submit, in one batch after lock, or by the quiz master. */
export type GradingMode = 'auto' | 'batch' | 'human';

/**
 * Everything the app knows about one question type. Entries are plain data
 * (no I/O); `QUESTION_KINDS` is keyed by every `QuestionType`, so a type
 * without an entry is a compile error rather than a crash live on stage.
 */
export interface QuestionKind<T extends QuestionType = QuestionType> {
  type: T;
  /** The one validation for an ImportQuestionPreview — import (via `decodeSheetRow`) and draft save both use it. */
  schema: z.ZodType;
  /** The payload codec: stored JSON is parsed against this (via `parseQuestionPayload`), never cast. */
  payload: z.ZodType<QuestionPayload>;
  /** How the question's options and answer map to and from the sheet's `options`/`answer` cells. */
  csv: QuestionCsvCodec;
  gradingMode: GradingMode;
  /** Whether the admin can regrade a single answer. */
  overridable: boolean;
  /** Its own field, never derived from `gradingMode`: free_text auto-grades but is excluded (ADR 0001). */
  kahootAllowed: boolean;
}

export const QUESTION_KINDS: {
  readonly [T in QuestionType]: QuestionKind<T>;
} & {
  /** The clip start/end a YouTube question carries in its `notes` (read at save time by `parseYoutubeClipFromNotes`). */
  readonly youtube: { readonly clipNotes: ClipNotesCodec };
} = {
  free_text: {
    type: 'free_text',
    schema: freeTextPreviewSchema,
    payload: freeTextPayloadSchema,
    csv: answerOnlyCsv,
    gradingMode: 'auto',
    overridable: true,
    kahootAllowed: false,
  },
  multiple_choice: {
    type: 'multiple_choice',
    schema: multipleChoicePreviewSchema,
    payload: multipleChoicePayloadSchema,
    csv: choicesCsv,
    gradingMode: 'auto',
    overridable: true,
    kahootAllowed: true,
  },
  audio: {
    type: 'audio',
    schema: audioPreviewSchema,
    payload: audioPayloadSchema,
    csv: answerOnlyCsv,
    gradingMode: 'human',
    overridable: true,
    kahootAllowed: false,
  },
  youtube: {
    type: 'youtube',
    schema: youtubePreviewSchema,
    payload: youtubePayloadSchema,
    csv: answerOnlyCsv,
    clipNotes: youtubeClipNotes,
    gradingMode: 'human',
    overridable: true,
    kahootAllowed: false,
  },
  sort: {
    type: 'sort',
    schema: sortPreviewSchema,
    payload: sortPayloadSchema,
    csv: sortCsv,
    gradingMode: 'auto',
    overridable: true,
    kahootAllowed: true,
  },
  match: {
    type: 'match',
    schema: matchPreviewSchema,
    payload: matchPayloadSchema,
    csv: matchCsv,
    gradingMode: 'auto',
    overridable: true,
    kahootAllowed: true,
  },
  closest_guess: {
    type: 'closest_guess',
    schema: closestGuessPreviewSchema,
    payload: closestGuessPayloadSchema,
    csv: answerOnlyCsv,
    gradingMode: 'batch',
    overridable: false,
    kahootAllowed: false,
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
