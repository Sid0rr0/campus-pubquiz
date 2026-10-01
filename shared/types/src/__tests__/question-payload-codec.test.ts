import { describe, expect, it } from 'vitest';
import { QUESTION_KINDS, parseQuestionPayload } from '../question-kind';
import { QUESTION_TYPES, type QuestionType } from '../question-types';

const IMAGE = 'https://example.com/a.png';

/** Stored JSON as the quiz save writes it today, per type. */
const VALID_STORED: Record<QuestionType, unknown> = {
  free_text: { mediaUrl: IMAGE },
  multiple_choice: { options: ['Paris', 'Rome'], answerMediaUrl: IMAGE },
  audio: { mediaUrl: 'https://example.com/a.mp3' },
  youtube: {
    mediaUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    mediaStartSeconds: 5,
    mediaEndSeconds: 20,
  },
  sort: { options: ['b', 'a'] },
  match: {
    options: ['x', 'y'],
    matchTargets: ['1', '2'],
    matchScoringMode: 'all_or_nothing',
  },
  closest_guess: {},
};

/** Malformed JSON per type: the wrong shape for a field that type reads. */
const MALFORMED_STORED: Record<QuestionType, unknown> = {
  free_text: { mediaUrl: 42 },
  multiple_choice: { options: 'Paris|Rome' },
  audio: { mediaUrl: ['x'] },
  youtube: { mediaStartSeconds: '5' },
  sort: { options: [1, 2] },
  match: { options: ['x'], matchTargets: 'nope' },
  closest_guess: 'not an object',
};

describe('question payload codec', () => {
  it.each(QUESTION_TYPES)('%s: accepts valid stored JSON', (type) => {
    expect(parseQuestionPayload(type, VALID_STORED[type])).toEqual(
      VALID_STORED[type],
    );
  });

  it.each(QUESTION_TYPES)('%s: rejects malformed stored JSON', (type) => {
    expect(() => parseQuestionPayload(type, MALFORMED_STORED[type])).toThrow();
  });

  it.each(QUESTION_TYPES)(
    '%s: its registry entry carries the codec',
    (type) => {
      expect(QUESTION_KINDS[type].payload).toBeDefined();
    },
  );

  it('accepts a payload without the option lists, which the preview schemas own', () => {
    expect(parseQuestionPayload('multiple_choice', {})).toEqual({});
  });

  it('keeps clip times on any type, as quiz save writes them for any YouTube link', () => {
    const stored = {
      mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
      mediaStartSeconds: 3,
    };
    expect(parseQuestionPayload('free_text', stored)).toEqual(stored);
  });

  it('drops keys the type does not read, such as a stored answer', () => {
    expect(
      parseQuestionPayload('free_text', { answer: 'secret', mediaUrl: IMAGE }),
    ).toEqual({ mediaUrl: IMAGE });
  });

  it('names the question type in the failure', () => {
    expect(() => parseQuestionPayload('sort', { options: 3 })).toThrow(/sort/);
  });
});
