import { describe, expect, it } from 'vitest';
import type { ImportQuestionPreview, ImportRoundPreview } from '../import';
import { checkQuestion } from '../question-kind';
import {
  decodeSheetRow,
  encodeSheetRow,
  sheetRowMetaSchema,
} from '../question-row-schema';
import { QUESTION_TYPES, type QuestionType } from '../question-types';

const YOUTUBE = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const IMAGE = 'https://example.com/answer.jpg';
const AUDIO = 'https://example.com/clip.mp3';

/** One fully populated question per type: every CSV-carried field set. */
const QUESTION_BY_TYPE: Record<QuestionType, ImportQuestionPreview> = {
  free_text: {
    type: 'free_text',
    prompt: 'Capital of France?',
    answer: 'Paris',
    points: 2,
    notes: 'Accept "Paree"',
    mediaUrl: 'https://example.com/flag.png',
    answerMediaUrl: IMAGE,
  },
  multiple_choice: {
    type: 'multiple_choice',
    prompt: 'Red planet?',
    answer: 'Mars',
    points: 1,
    options: ['Mars', 'Venus', 'Jupiter, the big one'],
    answerMediaUrl: IMAGE,
  },
  sort: {
    type: 'sort',
    prompt: 'Oldest first',
    // Display order differs from the answer order on purpose.
    options: ['Inception', 'Jaws', 'Titanic'],
    answer: 'Jaws|Titanic|Inception',
    points: 3,
  },
  match: {
    type: 'match',
    prompt: 'Capitals',
    options: ['Paris', 'Tokyo', 'Cairo'],
    matchTargets: ['Japan', 'Egypt', 'France'],
    // The right item for each left item, in left order.
    answer: 'France|Japan|Egypt',
    points: 3,
  },
  closest_guess: {
    type: 'closest_guess',
    prompt: 'How tall is the Eiffel Tower in metres?',
    answer: '330',
    points: 1,
    mediaUrl: 'https://example.com/tower.jpg',
  },
  number: {
    type: 'number',
    prompt: 'In what year did the Berlin Wall fall?',
    answer: '1989',
    points: 2,
    mediaUrl: 'https://example.com/wall.jpg',
  },
};

/** Media is carried by any type: a free text question with a clipped YouTube video. */
const YOUTUBE_QUESTION: ImportQuestionPreview = {
  type: 'free_text',
  prompt: 'Which movie?',
  answer: 'Jaws',
  points: 2,
  mediaUrl: YOUTUBE,
  answerMediaUrl: IMAGE,
  notes: 'Play the chorus',
  mediaStartSeconds: 82,
  mediaEndSeconds: 140,
};

const ROUND: ImportRoundPreview = {
  title: 'Round 1',
  breakAfter: true,
  category: 'Music',
  author: 'Sam',
  questions: [],
};

/** Exports `question` as a sheet row, then imports it back through its kind. */
function roundTrip(
  question: ImportQuestionPreview,
  round: ImportRoundPreview = ROUND,
  isLastInRound = true,
) {
  const row = {
    rowNumber: 2,
    ...encodeSheetRow(round, question, isLastInRound),
  };
  const {
    meta,
    question: candidate,
    sheetAnswerIssue,
  } = decodeSheetRow(row, question.type);
  return {
    row,
    meta: sheetRowMetaSchema.parse(meta),
    checked: checkQuestion(candidate),
    sheetAnswerIssue,
  };
}

describe('CSV round-trip through the question kinds', () => {
  it.each(QUESTION_TYPES)(
    'imports an exported %s question back as the same question',
    (type) => {
      const question = QUESTION_BY_TYPE[type];

      const { checked, sheetAnswerIssue } = roundTrip(question);

      expect(sheetAnswerIssue).toBeUndefined();
      expect(checked).toEqual({ success: true, data: question });
    },
  );

  it('writes the match pairs as explicit left+right cells', () => {
    const { row } = roundTrip(QUESTION_BY_TYPE.match);

    expect(row.options).toBe('Paris|Tokyo|Cairo+Japan|Egypt|France');
    expect(row.answer).toBe('Paris+France|Tokyo+Japan|Cairo+Egypt');
  });

  it('carries break_after, category and author on the last row of a round', () => {
    const { meta } = roundTrip(QUESTION_BY_TYPE.free_text);

    expect(meta).toEqual({
      round: 'Round 1',
      break_after: '1',
      category: 'Music',
      author: 'Sam',
      show_round_note: '',
    });
  });

  it('carries the round note and its show-on-screen setting on the last row of a round', () => {
    const shown = roundTrip(QUESTION_BY_TYPE.free_text, {
      ...ROUND,
      note: 'Say hi.\nThen the rules.',
      showNoteOnScreen: true,
    });
    const hostOnly = roundTrip(QUESTION_BY_TYPE.free_text, {
      ...ROUND,
      note: 'Host only',
    });
    const earlier = roundTrip(
      QUESTION_BY_TYPE.free_text,
      { ...ROUND, note: 'Host only', showNoteOnScreen: true },
      false,
    );

    expect(shown.row).toMatchObject({
      roundNote: 'Say hi.\nThen the rules.',
      showRoundNote: '1',
    });
    expect(shown.meta).toMatchObject({
      round_note: 'Say hi.\nThen the rules.',
      show_round_note: '1',
    });
    expect(hostOnly.row.showRoundNote).toBe('');
    expect(hostOnly.meta.round_note).toBe('Host only');
    expect(earlier.row).toMatchObject({ roundNote: '', showRoundNote: '' });
  });

  it('leaves round-level cells blank on earlier rows and on rounds without a break', () => {
    const earlier = roundTrip(QUESTION_BY_TYPE.free_text, ROUND, false).meta;
    const noBreak = roundTrip(
      QUESTION_BY_TYPE.free_text,
      { ...ROUND, breakAfter: false },
      true,
    ).meta;

    expect(earlier).toEqual({
      round: 'Round 1',
      break_after: '',
      category: '',
      show_round_note: '',
    });
    expect(noBreak.break_after).toBe('');
  });

  it('drops what the sheet has no column for (question id, match scoring mode)', () => {
    const { checked } = roundTrip({
      ...QUESTION_BY_TYPE.match,
      questionId: 7,
      matchScoringMode: 'all_or_nothing',
    });

    expect(checked).toEqual({ success: true, data: QUESTION_BY_TYPE.match });
  });
});

describe('video file clip in the notes cell', () => {
  const MP4 = 'https://example.com/clip.mp4';

  it('decodes a full notes group on an .mp4 media_url and encodes it back identically', () => {
    const notes =
      'Play the chorus\n{start: "1:22", end: "2:20", revealStart: "2:30", revealEnd: "2:45", hideVideo: true}';
    const row = {
      rowNumber: 2,
      ...encodeSheetRow(
        ROUND,
        { ...YOUTUBE_QUESTION, mediaUrl: MP4, answerMediaUrl: undefined },
        true,
      ),
      notes,
    };

    const { question } = decodeSheetRow(row, 'free_text');
    const { checked } = roundTrip({
      ...YOUTUBE_QUESTION,
      mediaUrl: MP4,
      answerMediaUrl: undefined,
      revealStartSeconds: 150,
      revealEndSeconds: 165,
      isVideoHidden: true,
    });

    expect(question).toMatchObject({
      mediaStartSeconds: 82,
      mediaEndSeconds: 140,
      revealStartSeconds: 150,
      revealEndSeconds: 165,
      isVideoHidden: true,
      notes: 'Play the chorus',
    });
    expect(checked.success && checked.data).toMatchObject({
      mediaUrl: MP4,
      isVideoHidden: true,
    });
    expect(
      encodeSheetRow(
        ROUND,
        checked.success ? checked.data : YOUTUBE_QUESTION,
        true,
      ).notes,
    ).toBe(notes);
  });

  it('keeps only the reveal clip for an image media_url with an .mp4 answer_media_url', () => {
    const { question } = decodeSheetRow(
      {
        rowNumber: 2,
        ...encodeSheetRow(ROUND, YOUTUBE_QUESTION, true),
        mediaUrl: IMAGE,
        answerMediaUrl: MP4,
        notes: '{start: "5", revealStart: "10", hideVideo: true}',
      },
      'free_text',
    );

    expect(question).toMatchObject({ revealStartSeconds: 10 });
    expect(question).not.toHaveProperty('mediaStartSeconds');
    expect(question).not.toHaveProperty('isVideoHidden');
  });
});

describe('YouTube clip in the notes cell', () => {
  const YOUTUBE_ROW = {
    rowNumber: 2,
    ...encodeSheetRow(ROUND, YOUTUBE_QUESTION, true),
  };

  it('exports the clip fields as a canonical group after the free notes', () => {
    expect(YOUTUBE_ROW.notes).toBe(
      'Play the chorus\n{start: "1:22", end: "2:20"}',
    );
  });

  it('exports a question without a clip with its notes unchanged', () => {
    const { row } = roundTrip({
      ...YOUTUBE_QUESTION,
      mediaStartSeconds: undefined,
      mediaEndSeconds: undefined,
    });

    expect(row.notes).toBe('Play the chorus');
  });

  it('omits an empty key from the exported group', () => {
    const { row } = roundTrip({
      ...YOUTUBE_QUESTION,
      notes: undefined,
      mediaEndSeconds: undefined,
    });

    expect(row.notes).toBe('{start: "1:22"}');
  });

  it('imports the sample CSV group {start: "55", end: "88"} into the clip fields', () => {
    const { question } = decodeSheetRow(
      { ...YOUTUBE_ROW, notes: '{start: "55", end: "88"}' },
      'free_text',
    );

    expect(question).toMatchObject({
      mediaStartSeconds: 55,
      mediaEndSeconds: 88,
      notes: undefined,
    });
  });

  it('imports the legacy YouTube clip line', () => {
    const { question } = decodeSheetRow(
      {
        ...YOUTUBE_ROW,
        notes: 'Hint\nYouTube clip: {start: "0:05", end: "0:20"}',
      },
      'free_text',
    );

    expect(question).toMatchObject({
      mediaStartSeconds: 5,
      mediaEndSeconds: 20,
      notes: 'Hint',
    });
  });

  it('imports hideVideo: true into isVideoHidden', () => {
    const { question } = decodeSheetRow(
      { ...YOUTUBE_ROW, notes: '{hideVideo: true}' },
      'free_text',
    );

    expect(question).toMatchObject({ isVideoHidden: true, notes: undefined });
  });

  it('exports a hidden video in the group and imports it back unchanged', () => {
    const hidden = {
      ...YOUTUBE_QUESTION,
      isVideoHidden: true as const,
    };
    const { row, checked } = roundTrip(hidden);

    expect(row.notes).toBe(
      'Play the chorus\n{start: "1:22", end: "2:20", hideVideo: true}',
    );
    expect(checked).toEqual({ success: true, data: hidden });
  });

  it('exports a video that is not hidden without a hideVideo key', () => {
    expect(YOUTUBE_ROW.notes).not.toContain('hideVideo');
  });

  it('round-trips the reveal clip through revealStart/revealEnd in the group', () => {
    const question: ImportQuestionPreview = {
      ...YOUTUBE_QUESTION,
      revealStartSeconds: 150,
      revealEndSeconds: 165,
    };
    const { row, checked } = roundTrip(question);

    expect(row.notes).toBe(
      'Play the chorus\n{start: "1:22", end: "2:20", revealStart: "2:30", revealEnd: "2:45"}',
    );
    expect(checked).toEqual({ success: true, data: question });
  });

  it('round-trips a reveal clip on a question whose only YouTube link is the answer media', () => {
    const question: ImportQuestionPreview = {
      type: 'free_text',
      prompt: 'Q?',
      answer: 'A',
      points: 1,
      mediaUrl: IMAGE,
      answerMediaUrl: YOUTUBE,
      revealStartSeconds: 5,
    };
    const { row, checked } = roundTrip(question);

    expect(row.notes).toBe('{revealStart: "5"}');
    expect(checked).toEqual({ success: true, data: question });
  });

  it('leaves a reveal group in the notes when neither media is YouTube', () => {
    const { question } = decodeSheetRow(
      {
        ...YOUTUBE_ROW,
        mediaUrl: AUDIO,
        answerMediaUrl: IMAGE,
        notes: '{revealStart: "0:05"}',
      },
      'free_text',
    );

    expect(question).toMatchObject({ notes: '{revealStart: "0:05"}' });
    expect(question).not.toHaveProperty('revealStartSeconds');
  });

  it('reports an issue on the notes cell for a clip time that is not a timecode', () => {
    const { clipIssues, question } = decodeSheetRow(
      { ...YOUTUBE_ROW, notes: '{start: "1:2x", revealEnd: "2:00"}' },
      'free_text',
    );

    expect(clipIssues).toEqual([
      {
        path: ['notes'],
        code: 'custom',
        message:
          'Clip time "start" is not a timecode — use seconds, M:SS or H:MM:SS',
      },
    ]);
    expect(question).not.toHaveProperty('mediaStartSeconds');
  });

  it('reports no clip issue for a valid group', () => {
    const { clipIssues } = decodeSheetRow(YOUTUBE_ROW, 'free_text');

    expect(clipIssues).toEqual([]);
  });

  it('leaves a clip-looking group in the notes of non-YouTube media', () => {
    const { question } = decodeSheetRow(
      {
        ...YOUTUBE_ROW,
        mediaUrl: AUDIO,
        notes: '{start: "0:05"}',
      },
      'free_text',
    );

    expect(question).toMatchObject({ notes: '{start: "0:05"}' });
    expect(question).not.toHaveProperty('mediaStartSeconds');
  });
});
