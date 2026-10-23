import { describe, expect, it } from 'vitest';
import { parseQuestionPayload } from '../question-kind';
import type { QuestionPayload } from '../question-payload-schema';
import { QUESTION_TYPES, type QuestionType } from '../question-types';
import {
  clipNotesFieldsFor,
  gradingSettingsFor,
  previewToStoredFields,
  rowToPreview,
  type StoredQuestionRow,
} from '../question-record-codec';

/**
 * The type-by-media round trip lives in question-record-round-trip.test.ts;
 * this file keeps what that table doesn't cover: legacy notes, unset fields
 * and notes handling.
 */

const IMAGE = 'https://example.com/a.png';
const YOUTUBE = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const YOUTUBE_FILE = 'https://example.com/clip.mp4';
const CLIP_NOTES = 'Hint\nYouTube clip: {start: "0:05", end: "0:20"}';

function rowOf(type: QuestionType, notes: string | null): StoredQuestionRow {
  return { id: 7, type, prompt: 'Q?', answer: 'A', points: 3, notes };
}

describe('question record codec', () => {
  it.each(QUESTION_TYPES)(
    '%s: the stored payload parses through its payload codec',
    (type) => {
      const { payload } = previewToStoredFields(
        rowToPreview(rowOf(type, 'Hint'), { mediaUrl: IMAGE }),
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

  it('keeps a Number question with no stored margin unset', () => {
    const preview = rowToPreview(rowOf('number', null), {});

    expect(preview).not.toHaveProperty('margin');
    expect(previewToStoredFields(preview).payload).not.toHaveProperty('margin');
  });

  it('keeps a set margin whose value is zero', () => {
    const payload: QuestionPayload = {
      margin: { value: 0, unit: 'absolute' },
    };

    const preview = rowToPreview(rowOf('number', null), payload);

    expect(preview.margin).toEqual({ value: 0, unit: 'absolute' });
  });

  it('loads a hideVideo group left in the notes: field set, group stripped', () => {
    const preview = rowToPreview(
      rowOf('free_text', 'Hint\n{hideVideo: true}'),
      {
        mediaUrl: YOUTUBE,
      },
    );

    expect(preview).toMatchObject({ notes: 'Hint', isVideoHidden: true });
  });

  it('strips a reveal group left in the notes of a stored row and fills the fields from it', () => {
    const preview = rowToPreview(
      rowOf('free_text', 'Hint\n{revealStart: "0:05"}'),
      { mediaUrl: 'https://example.com/a.jpg', answerMediaUrl: YOUTUBE },
    );

    expect(preview).toMatchObject({ notes: 'Hint', revealStartSeconds: 5 });
  });

  it('keeps the notes as written, free text only', () => {
    const stored = previewToStoredFields({
      type: 'free_text',
      prompt: 'Q?',
      answer: 'A',
      points: 1,
      notes: 'start: 0:03 is just a note',
      mediaUrl: YOUTUBE,
    });

    expect(stored.notes).toBe('start: 0:03 is just a note');
    expect(stored.payload).toEqual({ mediaUrl: YOUTUBE });
  });

  it('loads a stored row with a clip line in its notes: fields set, line stripped', () => {
    const preview = rowToPreview(rowOf('free_text', CLIP_NOTES), {
      mediaUrl: YOUTUBE,
    });

    expect(preview).toMatchObject({
      notes: 'Hint',
      mediaStartSeconds: 5,
      mediaEndSeconds: 20,
    });
  });

  it('prefers the payload clip over a clip group left in the notes', () => {
    const preview = rowToPreview(rowOf('free_text', CLIP_NOTES), {
      mediaUrl: YOUTUBE,
      mediaStartSeconds: 30,
    });

    expect(preview).toMatchObject({
      mediaStartSeconds: 30,
      mediaEndSeconds: 20,
    });
  });

  it('leaves the notes of a non-YouTube row alone', () => {
    const preview = rowToPreview(rowOf('free_text', CLIP_NOTES), {
      mediaUrl: 'https://example.com/a.mp3',
    });

    expect(preview.notes).toBe(CLIP_NOTES);
    expect(preview).not.toHaveProperty('mediaStartSeconds');
  });

  it('cleans the notes when a stripped row is saved again', () => {
    const preview = rowToPreview(rowOf('free_text', CLIP_NOTES), {
      mediaUrl: YOUTUBE,
    });

    expect(previewToStoredFields(preview)).toMatchObject({
      notes: 'Hint',
      payload: {
        mediaUrl: YOUTUBE,
        mediaStartSeconds: 5,
        mediaEndSeconds: 20,
      },
    });
  });

  it('carries no value that means "none": a false flag and a blank link stay out of the payload', () => {
    const { payload } = previewToStoredFields({
      type: 'free_text',
      prompt: 'Q?',
      answer: 'A',
      points: 1,
      mediaUrl: YOUTUBE_FILE,
      answerMediaUrl: '',
      isVideoHidden: false,
    });

    expect(payload).toStrictEqual({ mediaUrl: YOUTUBE_FILE });
  });

  it('reads a video row as not hidden when neither the payload nor the notes hide it', () => {
    const preview = rowToPreview(rowOf('free_text', null), {
      mediaUrl: YOUTUBE_FILE,
    });

    expect(preview).not.toHaveProperty('isVideoHidden');
  });

  it('reads a hidden video from the payload', () => {
    const preview = rowToPreview(rowOf('free_text', null), {
      mediaUrl: YOUTUBE_FILE,
      isVideoHidden: true,
    });

    expect(preview.isVideoHidden).toBe(true);
  });
});

describe('clipNotesFieldsFor', () => {
  it('names only the clip fields the preview sets, with no key for an unset one', () => {
    expect(
      clipNotesFieldsFor({ mediaUrl: YOUTUBE_FILE, mediaStartSeconds: 5 }),
    ).toStrictEqual({ startSeconds: 5 });
    expect(
      clipNotesFieldsFor({ mediaUrl: YOUTUBE_FILE, mediaEndSeconds: 9 }),
    ).toStrictEqual({ endSeconds: 9 });
    expect(
      clipNotesFieldsFor({ mediaUrl: YOUTUBE_FILE, revealStartSeconds: 2 }),
    ).toStrictEqual({ revealStartSeconds: 2 });
    expect(
      clipNotesFieldsFor({ mediaUrl: YOUTUBE_FILE, revealEndSeconds: 3 }),
    ).toStrictEqual({ revealEndSeconds: 3 });
    expect(clipNotesFieldsFor({ mediaUrl: YOUTUBE_FILE })).toStrictEqual({});
  });
});

describe('gradingSettingsFor', () => {
  it('keeps only the grading settings of the type, even from a whole preview', () => {
    const wholePreview = {
      margin: { value: 5, unit: 'percent' as const },
      matchScoringMode: 'all_or_nothing' as const,
      mediaUrl: IMAGE,
      options: ['a', 'b'],
    };

    expect(gradingSettingsFor('number', wholePreview)).toStrictEqual({
      margin: { value: 5, unit: 'percent' },
    });
    expect(gradingSettingsFor('match', wholePreview)).toStrictEqual({
      matchScoringMode: 'all_or_nothing',
    });
    expect(gradingSettingsFor('free_text', wholePreview)).toStrictEqual({});
  });
});
