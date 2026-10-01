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
/**
 * 'auto' grades every submission at submit; 'batch' grades all together once
 * the question locks; 'match-or-human' grades a submission matching the key
 * correct at submit and leaves any other to the moderator.
 */
export type GradingMode = 'auto' | 'batch' | 'match-or-human';

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
  /** Whether the question is unusable without a `mediaUrl` (the editor marks the field required). */
  requiresMedia: boolean;
  /** Whether the question carries a list of choices: never, always, or only when the author adds some (the answer is then one of them). */
  choices: 'none' | 'required' | 'optional';
  /** The one validation for an ImportQuestionPreview — import (via `decodeSheetRow`) and draft save both use it. */
  schema: z.ZodType;
  /** The payload codec: stored JSON is parsed against this (via `parseQuestionPayload`), never cast. */
  payload: z.ZodType<QuestionPayload>;
  /** How the question's options and answer map to and from the sheet's `options`/`answer` cells. */
  csv: QuestionCsvCodec;
  gradingMode: GradingMode;
  /** Whether the admin can regrade a single answer. */
  overridable: boolean;
  /** Its own field, never derived from `gradingMode`: free_text grades itself on a match but is excluded (ADR 0001). */
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
    label: 'Free text',
    moderatorNote:
      'No options. An answer matching the answer text (case and whitespace are ignored) is graded correct when a team submits; any other answer waits for you to grade it, and you can override any mark by hand.',
    inputKind: 'text',
    requiresMedia: false,
    choices: 'none',
    schema: freeTextPreviewSchema,
    payload: freeTextPayloadSchema,
    csv: answerOnlyCsv,
    gradingMode: 'match-or-human',
    overridable: true,
    kahootAllowed: false,
  },
  multiple_choice: {
    type: 'multiple_choice',
    label: 'Multiple choice',
    moderatorNote:
      'Options are separated by pipes (Paris|London|Berlin) and the answer must match one option exactly. Graded automatically when a team submits; you can override by hand.',
    inputKind: 'choice',
    requiresMedia: false,
    choices: 'required',
    schema: multipleChoicePreviewSchema,
    payload: multipleChoicePayloadSchema,
    csv: choicesCsv,
    gradingMode: 'auto',
    overridable: true,
    kahootAllowed: true,
  },
  audio: {
    type: 'audio',
    label: 'Audio',
    moderatorNote:
      'Needs an http audio link as its media. You can add options if you like. An answer matching the answer text (case and whitespace are ignored) is graded correct when a team submits; any other answer waits for you to grade it.',
    inputKind: 'text',
    requiresMedia: true,
    choices: 'optional',
    schema: audioPreviewSchema,
    payload: audioPayloadSchema,
    csv: choicesCsv,
    gradingMode: 'match-or-human',
    overridable: true,
    kahootAllowed: false,
  },
  youtube: {
    type: 'youtube',
    label: 'YouTube video',
    moderatorNote:
      'Needs a youtube.com or youtu.be link as its media; the notes can clip it, e.g. {start: "0:10", end: "0:25"}. You can add options if you like. An answer matching the answer text (case and whitespace are ignored) is graded correct when a team submits; any other answer waits for you to grade it.',
    inputKind: 'text',
    requiresMedia: true,
    choices: 'optional',
    schema: youtubePreviewSchema,
    payload: youtubePayloadSchema,
    csv: choicesCsv,
    clipNotes: youtubeClipNotes,
    gradingMode: 'match-or-human',
    overridable: true,
    kahootAllowed: false,
  },
  sort: {
    type: 'sort',
    label: 'Sort / order',
    moderatorNote:
      'Options are pipe-separated in any order and the answer lists them in the correct order. Graded automatically when a team submits; you can override by hand.',
    inputKind: 'sort',
    requiresMedia: false,
    choices: 'none',
    schema: sortPreviewSchema,
    payload: sortPayloadSchema,
    csv: sortCsv,
    gradingMode: 'auto',
    overridable: true,
    kahootAllowed: true,
  },
  match: {
    type: 'match',
    label: 'Match pairs',
    moderatorNote:
      'Options hold both lists as left1|left2+right1|right2 and the answer pairs them (Paris+France|Tokyo+Japan). Graded automatically when a team submits; you can override by hand.',
    inputKind: 'match',
    requiresMedia: false,
    choices: 'none',
    schema: matchPreviewSchema,
    payload: matchPayloadSchema,
    csv: matchCsv,
    gradingMode: 'auto',
    overridable: true,
    kahootAllowed: true,
  },
  closest_guess: {
    type: 'closest_guess',
    label: 'Closest guess',
    moderatorNote:
      'The answer is a number. Graded in one batch when the break starts: every team tied for the closest guess gets full points and everyone else gets zero. It cannot be overridden by hand.',
    inputKind: 'number',
    requiresMedia: false,
    choices: 'none',
    schema: closestGuessPreviewSchema,
    payload: closestGuessPayloadSchema,
    csv: answerOnlyCsv,
    gradingMode: 'batch',
    overridable: false,
    kahootAllowed: false,
  },
};

export function answerInputKind(type: QuestionType): AnswerInputKind {
  return QUESTION_KINDS[type].inputKind;
}

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
