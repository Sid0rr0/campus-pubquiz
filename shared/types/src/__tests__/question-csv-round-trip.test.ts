import { describe, expect, it } from 'vitest';
import type { ImportQuestionPreview, ImportRoundPreview } from '../import';
import { QUESTION_KINDS, checkQuestion } from '../question-kind';
import {
  decodeSheetRow,
  encodeSheetRow,
  sheetRowMetaSchema,
} from '../question-row-schema';
import { QUESTION_TYPES, type QuestionType } from '../question-types';
import { parseYoutubeClipFromNotes } from '../youtube';

const YOUTUBE = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const IMAGE = 'https://example.com/answer.jpg';
const AUDIO = 'https://example.com/clip.mp3';
const CLIP_NOTES = QUESTION_KINDS.youtube.clipNotes.write(
  'Play the chorus',
  '1:22',
  '2:20',
);

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
    notes: CLIP_NOTES,
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

  it('keeps the YouTube clip seconds the notes carry', () => {
    const { checked } = roundTrip(QUESTION_BY_TYPE.youtube);

    const notes = (checked as { data: ImportQuestionPreview }).data.notes;
    expect(parseYoutubeClipFromNotes(notes)).toEqual({
      startSeconds: 82,
      endSeconds: 140,
    });
  });

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

describe('YouTube clip notes', () => {
  const { clipNotes } = QUESTION_KINDS.youtube;

  it('reads back the clip fields and free notes it wrote', () => {
    expect(clipNotes.read(CLIP_NOTES)).toEqual({
      freeNotes: 'Play the chorus',
      clipStart: '1:22',
      clipEnd: '2:20',
    });
  });

  it('writes only the free notes when no clip is set', () => {
    expect(clipNotes.write('Just notes', '', '')).toBe('Just notes');
  });

  it('writes only the clip line when there are no free notes', () => {
    const notes = clipNotes.write('', '0:10', '');

    expect(notes).toBe('YouTube clip: {start: "0:10", end: ""}');
    expect(parseYoutubeClipFromNotes(notes)).toEqual({ startSeconds: 10 });
  });

  it('treats hand-written notes without the clip line as free notes', () => {
    expect(clipNotes.read('{start: "55", end: "88"}')).toEqual({
      freeNotes: '{start: "55", end: "88"}',
      clipStart: '',
      clipEnd: '',
    });
  });
});
