import { describe, expect, it } from 'vitest';
import { QUESTION_KINDS } from '../question-kind';
import { parseQuestionPayload } from '../question-kind';
import type { QuestionPayload } from '../question-payload-schema';
import { QUESTION_TYPES, type QuestionType } from '../question-types';
import {
  previewToStoredFields,
  rowToPreview,
  rowToSeededQuestion,
  type StoredQuestionRow,
} from '../question-record-codec';

const IMAGE = 'https://example.com/a.png';
const YOUTUBE = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const CLIP_NOTES = 'Hint\nYouTube clip: {start: "0:05", end: "0:20"}';

/** Every payload field and grading setting each type allows, filled in. */
const FULL_PAYLOAD: Record<QuestionType, QuestionPayload> = {
  free_text: { mediaUrl: IMAGE, answerMediaUrl: IMAGE },
  multiple_choice: {
    options: ['Paris', 'Rome'],
    mediaUrl: IMAGE,
    answerMediaUrl: IMAGE,
  },
  audio: {
    options: ['Paris', 'Rome'],
    mediaUrl: 'https://example.com/a.mp3',
    answerMediaUrl: IMAGE,
  },
  youtube: {
    options: ['Paris', 'Rome'],
    mediaUrl: YOUTUBE,
    answerMediaUrl: IMAGE,
    mediaStartSeconds: 5,
    mediaEndSeconds: 20,
  },
  sort: { options: ['b', 'a'], mediaUrl: IMAGE, answerMediaUrl: IMAGE },
  match: {
    options: ['x', 'y'],
    matchTargets: ['1', '2'],
    matchScoringMode: 'all_or_nothing',
    mediaUrl: IMAGE,
    answerMediaUrl: IMAGE,
  },
  closest_guess: { mediaUrl: IMAGE, answerMediaUrl: IMAGE },
  number: {
    margin: { value: 5, unit: 'absolute' },
    mediaUrl: IMAGE,
    answerMediaUrl: IMAGE,
  },
};

function rowOf(type: QuestionType, notes: string | null): StoredQuestionRow {
  return { id: 7, type, prompt: 'Q?', answer: 'A', points: 3, notes };
}

function notesFor(type: QuestionType): string | null {
  return type === 'youtube' ? CLIP_NOTES : 'Hint';
}

describe('question record codec', () => {
  it.each(QUESTION_TYPES)(
    '%s: row to preview to stored fields gives back the same columns and payload',
    (type) => {
      const row = rowOf(type, notesFor(type));
      const payload = FULL_PAYLOAD[type];

      const stored = previewToStoredFields(rowToPreview(row, payload));

      expect(stored).toEqual({
        type,
        prompt: 'Q?',
        answer: 'A',
        points: 3,
        notes: notesFor(type),
        payload,
      });
    },
  );

  it.each(QUESTION_TYPES)(
    '%s: the stored payload parses through its payload codec',
    (type) => {
      const { payload } = previewToStoredFields(
        rowToPreview(rowOf(type, notesFor(type)), FULL_PAYLOAD[type]),
      );
      expect(parseQuestionPayload(type, payload)).toEqual(payload);
    },
  );

  it.each(QUESTION_TYPES)('%s: the preview carries the row id', (type) => {
    expect(rowToPreview(rowOf(type, null), {}).questionId).toBe(7);
  });

  it.each(QUESTION_TYPES)(
    '%s: unset settings and absent fields stay unset',
    (type) => {
      const preview = rowToPreview(rowOf(type, null), {});

      expect(preview).toEqual({
        questionId: 7,
        type,
        prompt: 'Q?',
        answer: 'A',
        points: 3,
      });
      expect(previewToStoredFields(preview)).toEqual({
        type,
        prompt: 'Q?',
        answer: 'A',
        points: 3,
        notes: null,
        payload: {},
      });
    },
  );

  it.each(QUESTION_TYPES)(
    '%s: a setting the type does not list is dropped in both directions',
    (type) => {
      const stray: QuestionPayload = {
        matchScoringMode: 'all_or_nothing',
        margin: { value: 1, unit: 'percent' },
      };
      const listed = QUESTION_KINDS[type].gradingSettings;

      const preview = rowToPreview(rowOf(type, null), stray);
      const stored = previewToStoredFields({
        ...preview,
        ...stray,
      });

      for (const name of ['matchScoringMode', 'margin'] as const) {
        const isListed = listed.includes(name);
        expect(name in preview).toBe(isListed);
        expect(name in stored.payload).toBe(isListed);
      }
    },
  );

  it.each(QUESTION_TYPES)(
    '%s: row to seeded question carries every payload field the type allows',
    (type) => {
      const payload = FULL_PAYLOAD[type];

      expect(rowToSeededQuestion(rowOf(type, 'Hint'), payload)).toEqual({
        id: 7,
        type,
        prompt: 'Q?',
        answer: 'A',
        points: 3,
        ...payload,
      });
    },
  );

  it.each(QUESTION_TYPES)(
    '%s: row to seeded question leaves unset fields and settings unset',
    (type) => {
      expect(rowToSeededQuestion(rowOf(type, null), {})).toEqual({
        id: 7,
        type,
        prompt: 'Q?',
        answer: 'A',
        points: 3,
      });
    },
  );

  it.each(QUESTION_TYPES)(
    '%s: row to seeded question drops a setting the type does not list',
    (type) => {
      const stray: QuestionPayload = {
        matchScoringMode: 'all_or_nothing',
        margin: { value: 1, unit: 'percent' },
      };
      const listed = QUESTION_KINDS[type].gradingSettings;

      const seeded = rowToSeededQuestion(rowOf(type, null), stray);

      for (const name of ['matchScoringMode', 'margin'] as const) {
        expect(name in seeded).toBe(listed.includes(name));
      }
    },
  );

  it('reads the clip bounds from the notes for any YouTube media link', () => {
    const stored = previewToStoredFields({
      type: 'free_text',
      prompt: 'Q?',
      answer: 'A',
      points: 1,
      notes: 'start: 0:03, end: 0:09',
      mediaUrl: YOUTUBE,
    });

    expect(stored.payload).toEqual({
      mediaUrl: YOUTUBE,
      mediaStartSeconds: 3,
      mediaEndSeconds: 9,
    });
  });

  it('ignores clip notes when the media is not a YouTube link', () => {
    const stored = previewToStoredFields({
      type: 'audio',
      prompt: 'Q?',
      answer: 'A',
      points: 1,
      notes: CLIP_NOTES,
      mediaUrl: 'https://example.com/a.mp3',
    });

    expect(stored.payload).toEqual({ mediaUrl: 'https://example.com/a.mp3' });
  });
});
