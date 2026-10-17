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
  audio: {
    type: 'audio',
    prompt: 'Name the song',
    answer: 'Bohemian Rhapsody',
    points: 3,
    mediaUrl: AUDIO,
    notes: 'Fade in',
  },
  youtube: {
    type: 'youtube',
    prompt: 'Which movie?',
    answer: 'Jaws',
    points: 2,
    mediaUrl: YOUTUBE,
    answerMediaUrl: IMAGE,
    notes: 'Play the chorus',
    mediaStartSeconds: 82,
    mediaEndSeconds: 140,
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
    // CSV carries no margin: an imported Number question gets the default.
    margin: { value: 10, unit: 'percent' },
  },
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
    });
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

describe('audio and youtube questions with choices', () => {
  it.each(['audio', 'youtube'] as const)(
    'round-trips a %s question with options',
    (type) => {
      const question: ImportQuestionPreview = {
        ...QUESTION_BY_TYPE[type],
        options: ['Jaws', 'Alien', 'Heat'],
        answer: 'Jaws',
      };

      const { checked, row } = roundTrip(question);

      expect(row.options).toBe('Jaws|Alien|Heat');
      expect(checked).toEqual({ success: true, data: question });
    },
  );

  it.each(['audio', 'youtube'] as const)(
    'rejects %s options that omit the answer, repeat, or number fewer than two',
    (type) => {
      const base = QUESTION_BY_TYPE[type];

      const missingAnswer = checkQuestion({ ...base, options: ['A', 'B'] });
      const repeated = checkQuestion({
        ...base,
        options: [base.answer, base.answer],
      });
      const single = checkQuestion({ ...base, options: [base.answer] });

      for (const result of [missingAnswer, repeated, single]) {
        expect(result.success).toBe(false);
      }
    },
  );

  it('treats an empty options list as no choices', () => {
    const result = checkQuestion({ ...QUESTION_BY_TYPE.audio, options: [] });

    expect(result).toEqual({ success: true, data: QUESTION_BY_TYPE.audio });
  });
});

describe('YouTube clip in the notes cell', () => {
  const YOUTUBE_ROW = {
    rowNumber: 2,
    ...encodeSheetRow(ROUND, QUESTION_BY_TYPE.youtube, true),
  };

  it('exports the clip fields as a canonical group after the free notes', () => {
    expect(YOUTUBE_ROW.notes).toBe(
      'Play the chorus\n{start: "1:22", end: "2:20"}',
    );
  });

  it('exports a question without a clip with its notes unchanged', () => {
    const { row } = roundTrip({
      ...QUESTION_BY_TYPE.youtube,
      mediaStartSeconds: undefined,
      mediaEndSeconds: undefined,
    });

    expect(row.notes).toBe('Play the chorus');
  });

  it('omits an empty key from the exported group', () => {
    const { row } = roundTrip({
      ...QUESTION_BY_TYPE.youtube,
      notes: undefined,
      mediaEndSeconds: undefined,
    });

    expect(row.notes).toBe('{start: "1:22"}');
  });

  it('imports the sample CSV group {start: "55", end: "88"} into the clip fields', () => {
    const { question } = decodeSheetRow(
      { ...YOUTUBE_ROW, notes: '{start: "55", end: "88"}' },
      'youtube',
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
      'youtube',
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
      'youtube',
    );

    expect(question).toMatchObject({ isVideoHidden: true, notes: undefined });
  });

  it('exports a hidden video in the group and imports it back unchanged', () => {
    const hidden = {
      ...QUESTION_BY_TYPE.youtube,
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

  it('leaves a clip-looking group in the notes of non-YouTube media', () => {
    const { question } = decodeSheetRow(
      {
        ...YOUTUBE_ROW,
        mediaUrl: AUDIO,
        notes: '{start: "0:05"}',
      },
      'audio',
    );

    expect(question).toMatchObject({ notes: '{start: "0:05"}' });
    expect(question).not.toHaveProperty('mediaStartSeconds');
  });
});
