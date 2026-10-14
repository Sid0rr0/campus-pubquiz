import type { ImportQuestionPreview } from './import';
import { QUESTION_KINDS, type GradingSettingName } from './question-kind';
import type { QuestionPayload } from './question-payload-schema';
import type { QuestionType } from './question-types';
import type { SeededQuestion } from './question-views';
import { extractYoutubeVideoId, parseYoutubeClipFromNotes } from './youtube';

/**
 * The question record codec: a question's stored row (columns plus a payload
 * already parsed by `parseQuestionPayload`) to and from its preview, the shape
 * the quiz editor and import work with. Pure (no I/O). Options, match targets
 * and media are copied once here; grading settings are spread from the
 * registry's list for the type, so a setting the type doesn't carry never
 * crosses. Unset stays unset: defaults belong to the Answer key.
 */

/** The columns of a stored question row the codec reads. */
export interface StoredQuestionRow {
  id: number;
  type: QuestionType;
  prompt: string;
  answer: string;
  points: number;
  notes?: string | null;
}

/** The columns and payload a quiz save writes for one question. */
export interface StoredQuestionFields {
  type: QuestionType;
  prompt: string;
  answer: string;
  points: number;
  notes: string | null;
  payload: QuestionPayload;
}

type GradingSettingFields = Pick<QuestionPayload, GradingSettingName>;

/** The grading settings the type's registry entry lists, copied from the source; unset ones are left out. */
function gradingSettingsFrom(
  type: QuestionType,
  source: GradingSettingFields,
): GradingSettingFields {
  return QUESTION_KINDS[type].gradingSettings.reduce<GradingSettingFields>(
    (settings, name) =>
      source[name] === undefined
        ? settings
        : { ...settings, [name]: source[name] },
    {},
  );
}

/** The fields the preview and the payload both carry, each present only when set. */
function sharedFieldsFrom(source: QuestionPayload) {
  return {
    ...(source.options ? { options: source.options } : {}),
    ...(source.matchTargets ? { matchTargets: source.matchTargets } : {}),
    ...(source.mediaUrl ? { mediaUrl: source.mediaUrl } : {}),
    ...(source.answerMediaUrl ? { answerMediaUrl: source.answerMediaUrl } : {}),
  };
}

/** A stored row and its parsed payload as the preview the editor and import work with. */
export function rowToPreview(
  row: StoredQuestionRow,
  payload: QuestionPayload,
): ImportQuestionPreview {
  return {
    questionId: row.id,
    type: row.type,
    prompt: row.prompt,
    answer: row.answer,
    points: row.points,
    ...(row.notes ? { notes: row.notes } : {}),
    ...sharedFieldsFrom(payload),
    ...gradingSettingsFrom(row.type, payload),
  };
}

/**
 * A stored row and its parsed payload as the question a session holds. Only the
 * payload fields named here reach the seeded game: imported questions also
 * carry the correct answer in their payload, which must never reach a
 * QuestionView (snapshots go to every connected phone and the big screen). A
 * grading setting the type doesn't list never crosses either.
 */
export function rowToSeededQuestion(
  row: StoredQuestionRow,
  payload: QuestionPayload,
): SeededQuestion {
  return {
    id: row.id,
    type: row.type,
    prompt: row.prompt,
    points: row.points,
    answer: row.answer,
    ...sharedFieldsFrom(payload),
    ...gradingSettingsFrom(row.type, payload),
    ...(payload.mediaStartSeconds !== undefined
      ? { mediaStartSeconds: payload.mediaStartSeconds }
      : {}),
    ...(payload.mediaEndSeconds !== undefined
      ? { mediaEndSeconds: payload.mediaEndSeconds }
      : {}),
  };
}

/** A preview as the columns and payload a save writes; the YouTube clip bounds are read from the notes. */
export function previewToStoredFields(
  preview: ImportQuestionPreview,
): StoredQuestionFields {
  const clip =
    preview.mediaUrl && extractYoutubeVideoId(preview.mediaUrl)
      ? parseYoutubeClipFromNotes(preview.notes)
      : undefined;
  return {
    type: preview.type,
    prompt: preview.prompt,
    answer: preview.answer,
    points: preview.points,
    notes: preview.notes ?? null,
    payload: {
      ...sharedFieldsFrom(preview),
      ...gradingSettingsFrom(preview.type, preview),
      ...(clip?.startSeconds !== undefined
        ? { mediaStartSeconds: clip.startSeconds }
        : {}),
      ...(clip?.endSeconds !== undefined
        ? { mediaEndSeconds: clip.endSeconds }
        : {}),
    },
  };
}
