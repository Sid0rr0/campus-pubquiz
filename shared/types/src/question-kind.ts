import type { z } from 'zod';
import type { QuestionType } from './question-types';
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
  audioRowSchema,
  closestGuessRowSchema,
  freeTextRowSchema,
  matchRowSchema,
  multipleChoiceRowSchema,
  sortRowSchema,
  youtubeRowSchema,
} from './question-row-schema';

/** How a type's answers are graded: at submit, in one batch after lock, or by the quiz master. */
export type GradingMode = 'auto' | 'batch' | 'human';

/**
 * Everything the app knows about one question type. Entries are plain data
 * (no I/O); `QUESTION_KINDS` is keyed by every `QuestionType`, so a type
 * without an entry is a compile error rather than a crash live on stage.
 */
export interface QuestionKind<T extends QuestionType = QuestionType> {
  type: T;
  /** Import path: validates a sheet row decoded by `decodeSheetRow`. */
  importSchema: z.ZodType;
  /** Draft path: validates an ImportQuestionPreview from the editor or a CSV preview. */
  draftSchema: z.ZodType;
  gradingMode: GradingMode;
  /** Whether the admin can regrade a single answer. */
  overridable: boolean;
  /** Its own field, never derived from `gradingMode`: free_text auto-grades but is excluded (ADR 0001). */
  kahootAllowed: boolean;
}

export const QUESTION_KINDS: {
  readonly [T in QuestionType]: QuestionKind<T>;
} = {
  free_text: {
    type: 'free_text',
    importSchema: freeTextRowSchema,
    draftSchema: freeTextPreviewSchema,
    gradingMode: 'auto',
    overridable: true,
    kahootAllowed: false,
  },
  multiple_choice: {
    type: 'multiple_choice',
    importSchema: multipleChoiceRowSchema,
    draftSchema: multipleChoicePreviewSchema,
    gradingMode: 'auto',
    overridable: true,
    kahootAllowed: true,
  },
  audio: {
    type: 'audio',
    importSchema: audioRowSchema,
    draftSchema: audioPreviewSchema,
    gradingMode: 'human',
    overridable: true,
    kahootAllowed: false,
  },
  youtube: {
    type: 'youtube',
    importSchema: youtubeRowSchema,
    draftSchema: youtubePreviewSchema,
    gradingMode: 'human',
    overridable: true,
    kahootAllowed: false,
  },
  sort: {
    type: 'sort',
    importSchema: sortRowSchema,
    draftSchema: sortPreviewSchema,
    gradingMode: 'auto',
    overridable: true,
    kahootAllowed: true,
  },
  match: {
    type: 'match',
    importSchema: matchRowSchema,
    draftSchema: matchPreviewSchema,
    gradingMode: 'auto',
    overridable: true,
    kahootAllowed: true,
  },
  closest_guess: {
    type: 'closest_guess',
    importSchema: closestGuessRowSchema,
    draftSchema: closestGuessPreviewSchema,
    gradingMode: 'batch',
    overridable: false,
    kahootAllowed: false,
  },
};
