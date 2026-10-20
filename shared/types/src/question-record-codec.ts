import type { ImportQuestionPreview } from './import';
import { resolveAnswerKind, type AnswerKind } from './answer-kind';
import { QUESTION_KINDS, type GradingSettingName } from './question-kind';
import type { QuestionPayload } from './question-payload-schema';
import type { QuestionType } from './question-types';
import type { SeededQuestion } from './question-views';
import { hasVideoMedia, isVideoUrl } from './media';
import { parseClipNotes, type ClipNotesFields } from './notes-group';

/**
 * The question record codec: a question's stored row (columns plus a payload
 * already parsed by `parseQuestionPayload`) to and from its preview, the shape
 * the quiz editor and import work with, and to the seeded question a session
 * holds. Pure (no I/O). Every conversion copies options, match targets, media,
 * clip and grading setting fields through one field table, so a field the type
 * or media doesn't allow never crosses. Unset stays unset: defaults belong to
 * the Answer key.
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

/** The links a question's media fields are decided from. */
interface MediaLinks {
  mediaUrl?: string;
  answerMediaUrl?: string;
}

/** The payload and preview fields the field table decides. */
type TableField = keyof QuestionPayload;

/**
 * When a question carries a field:
 * - `set`: whenever it has a value;
 * - `answer-kind`: when the type's answer kind uses it;
 * - `grading-setting`: when the type's registry entry lists it;
 * - `question-video`: when the question media is a video;
 * - `either-video`: when the question media or the answer media is a video.
 */
type FieldRule =
  | { when: 'set' }
  | { when: 'answer-kind'; kinds: readonly AnswerKind[] }
  | { when: 'grading-setting' }
  | { when: 'question-video' }
  | { when: 'either-video' };

type FieldTableRow = { field: TableField } & FieldRule;

/** Every grading setting name, checked against the registry's type so a new one cannot be missed. */
const GRADING_SETTING_FIELDS = {
  matchScoringMode: true,
  margin: true,
} satisfies Record<GradingSettingName, true>;

/**
 * The one field table: each payload and preview field and the condition under
 * which a question carries it. Every conversion copies through it. The grading
 * settings refer to the registry's list for the type, never copy it.
 */
const FIELD_TABLE: readonly FieldTableRow[] = [
  {
    field: 'options',
    when: 'answer-kind',
    kinds: ['choice', 'sort', 'match'],
  },
  { field: 'matchTargets', when: 'answer-kind', kinds: ['match'] },
  { field: 'mediaUrl', when: 'set' },
  { field: 'answerMediaUrl', when: 'set' },
  { field: 'mediaStartSeconds', when: 'question-video' },
  { field: 'mediaEndSeconds', when: 'question-video' },
  { field: 'isVideoHidden', when: 'question-video' },
  { field: 'revealStartSeconds', when: 'either-video' },
  { field: 'revealEndSeconds', when: 'either-video' },
  ...(Object.keys(GRADING_SETTING_FIELDS) as GradingSettingName[]).map(
    (field): FieldTableRow => ({ field, when: 'grading-setting' }),
  ),
];

/** Whether a rule that depends only on the media links holds for them. */
function mediaRuleHolds(
  when: 'question-video' | 'either-video',
  links: MediaLinks,
): boolean {
  return when === 'question-video'
    ? isVideoUrl(links.mediaUrl)
    : hasVideoMedia(links);
}

function carries(
  row: FieldTableRow,
  type: QuestionType,
  links: MediaLinks,
): boolean {
  switch (row.when) {
    case 'set':
      return true;
    case 'answer-kind':
      return row.kinds.includes(resolveAnswerKind({ type }));
    case 'grading-setting':
      return QUESTION_KINDS[type].gradingSettings.some(
        (name) => name === row.field,
      );
    case 'question-video':
    case 'either-video':
      return mediaRuleHolds(row.when, links);
  }
}

/** Whether a field value is one to carry: unset, `false` and `''` all mean "no value". */
function hasValue(value: unknown): boolean {
  return value !== undefined && value !== false && value !== '';
}

/** The values of the source that have one and whose table row passes the check; the one loop both field pickers share. */
function pickCarried(
  source: QuestionPayload,
  isCarried: (row: FieldTableRow) => boolean,
): QuestionPayload {
  const carried: Record<string, unknown> = {};
  for (const row of FIELD_TABLE) {
    const value = source[row.field];
    if (hasValue(value) && isCarried(row)) carried[row.field] = value;
  }
  return carried;
}

/** The fields of the source the question's type and media carry; a field without a value is left out. */
function carriedFields(
  type: QuestionType,
  source: QuestionPayload,
): QuestionPayload {
  return pickCarried(source, (row) => carries(row, type, source));
}

/** The clip fields a preview carries for a question media link and an answer media link, taken from the candidate; a candidate field without a value is left out. */
export function clipFieldsFor(
  links: MediaLinks,
  candidate: ClipFields,
): ClipFields {
  return pickCarried(
    candidate,
    (row) =>
      (row.when === 'question-video' || row.when === 'either-video') &&
      mediaRuleHolds(row.when, links),
  );
}

/** The notes-group fields a sheet row carries for a question: the preview's clip fields the field table allows for its media, renamed to the group's. */
export function clipNotesFieldsFor(question: MediaLinks & ClipFields) {
  const clip = clipFieldsFor(question, question);
  const notes: ClipNotesFields = {
    ...(clip.isVideoHidden ? { isVideoHidden: true } : {}),
    ...(clip.mediaStartSeconds !== undefined
      ? { startSeconds: clip.mediaStartSeconds }
      : {}),
    ...(clip.mediaEndSeconds !== undefined
      ? { endSeconds: clip.mediaEndSeconds }
      : {}),
    ...(clip.revealStartSeconds !== undefined
      ? { revealStartSeconds: clip.revealStartSeconds }
      : {}),
    ...(clip.revealEndSeconds !== undefined
      ? { revealEndSeconds: clip.revealEndSeconds }
      : {}),
  };
  return notes;
}

/** The grading settings of a candidate that its type carries; one without a value is left out. */
export function gradingSettingsFor(
  type: QuestionType,
  candidate: Pick<QuestionPayload, 'margin' | 'matchScoringMode'>,
): Pick<QuestionPayload, 'margin' | 'matchScoringMode'> {
  return pickCarried(
    candidate,
    (row) => row.when === 'grading-setting' && carries(row, type, {}),
  );
}

/** The preview clip fields a parsed notes group fills for a question's media links; what the field table doesn't allow for them is left out. */
export function clipFieldsFromNotes(
  links: MediaLinks,
  clip: ClipNotesFields,
): ClipFields {
  return clipFieldsFor(links, {
    mediaStartSeconds: clip.startSeconds,
    mediaEndSeconds: clip.endSeconds,
    isVideoHidden: clip.isVideoHidden,
    revealStartSeconds: clip.revealStartSeconds,
    revealEndSeconds: clip.revealEndSeconds,
  });
}

/** The clip fields of a preview: the clip, the hidden-video flag and the reveal clip. */
export type ClipFields = Pick<
  ImportQuestionPreview,
  | 'mediaStartSeconds'
  | 'mediaEndSeconds'
  | 'isVideoHidden'
  | 'revealStartSeconds'
  | 'revealEndSeconds'
>;

/** A stored row and its parsed payload as the preview the editor and import work with. */
export function rowToPreview(
  row: StoredQuestionRow,
  payload: QuestionPayload,
): ImportQuestionPreview {
  // A clip group left in the notes by an older save is stripped; the payload
  // fields stay the truth, the group only fills what the payload lacks.
  const { freeNotes, clip } = hasVideoMedia(payload)
    ? parseClipNotes(row.notes ?? undefined)
    : { freeNotes: row.notes ?? '', clip: {} as ClipNotesFields };
  return {
    questionId: row.id,
    type: row.type,
    prompt: row.prompt,
    answer: row.answer,
    points: row.points,
    ...(freeNotes ? { notes: freeNotes } : {}),
    ...carriedFields(row.type, {
      ...payload,
      mediaStartSeconds: payload.mediaStartSeconds ?? clip.startSeconds,
      mediaEndSeconds: payload.mediaEndSeconds ?? clip.endSeconds,
      isVideoHidden: payload.isVideoHidden || clip.isVideoHidden,
      revealStartSeconds: payload.revealStartSeconds ?? clip.revealStartSeconds,
      revealEndSeconds: payload.revealEndSeconds ?? clip.revealEndSeconds,
    }),
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
    ...carriedFields(row.type, payload),
  };
}

/** A preview as the columns and payload a save writes; the clip fields reach the payload only for a video media link. */
export function previewToStoredFields(
  preview: ImportQuestionPreview,
): StoredQuestionFields {
  return {
    type: preview.type,
    prompt: preview.prompt,
    answer: preview.answer,
    points: preview.points,
    notes: preview.notes ?? null,
    payload: carriedFields(preview.type, preview),
  };
}
