import { describe, expect, it } from 'vitest';
import {
  ANSWER_FORMATS,
  formatAnswer,
  resolveAnswerKind,
  type AnswerKind,
} from '../answer-kind';
import { IDK_ANSWER_VALUE } from '../answers';
import { QUESTION_KINDS } from '../question-kind';
import { QUESTION_TYPES } from '../question-types';
import {
  gradeClosestGuessBatch,
  isBatchGradedType,
  scoreSubmission,
} from '../scoring';

describe('resolveAnswerKind', () => {
  it.each([
    ['free_text', undefined, 'text'],
    ['free_text', ['a'], 'text'],
    ['multiple_choice', ['a', 'b'], 'choice'],
    ['multiple_choice', undefined, 'choice'],
    ['multiple_choice', [], 'choice'],
    ['audio', undefined, 'text'],
    ['audio', [], 'text'],
    ['audio', ['', '  '], 'text'],
    ['audio', ['', 'Queen'], 'choice'],
    ['youtube', ['Queen', 'Kings'], 'choice'],
    ['youtube', ['  '], 'text'],
    ['sort', ['a', 'b'], 'sort'],
    ['match', ['a', 'b'], 'match'],
    ['closest_guess', undefined, 'number'],
  ] as const)('%s with choices %j is %s', (type, options, expected) => {
    expect(
      resolveAnswerKind({ type, options: options as string[] | undefined }),
    ).toBe(expected);
  });

  it('covers every question type', () => {
    for (const type of QUESTION_TYPES) {
      expect(Object.keys(ANSWER_FORMATS)).toContain(
        resolveAnswerKind({ type }),
      );
    }
  });
});

describe('answer formats decode and encode', () => {
  it.each(['text', 'number', 'choice'] as const)(
    '%s round-trips the stored string',
    (kind) => {
      const format = ANSWER_FORMATS[kind];
      expect(format.encode(format.decode('Paris'))).toBe('Paris');
    },
  );

  it.each(['sort', 'match'] as const)(
    '%s decodes stray whitespace and empty items and re-encodes canonically',
    (kind) => {
      const format = ANSWER_FORMATS[kind];
      expect(format.decode(' a ||b| c |')).toEqual(['a', 'b', 'c']);
      expect(format.encode(['a', 'b', 'c'])).toBe('a|b|c');
      expect(format.encode(format.decode(' a ||b| c |'))).toBe('a|b|c');
      expect(format.decode('')).toEqual([]);
    },
  );
});

describe('formatAnswer', () => {
  it.each(['free_text', 'sort', 'match', 'closest_guess'] as const)(
    'shows "I don\'t know" for %s',
    (type) => {
      expect(formatAnswer(IDK_ANSWER_VALUE, { type })).toBe("🤷 I don't know");
    },
  );

  it('returns text, choice and number values as-is', () => {
    expect(formatAnswer('Paris', { type: 'free_text' })).toBe('Paris');
    expect(formatAnswer('Paris', { type: 'multiple_choice' })).toBe('Paris');
    expect(formatAnswer('42', { type: 'closest_guess' })).toBe('42');
  });

  it('chains sort items with arrows, ignoring stray whitespace', () => {
    expect(formatAnswer(' a |b||c', { type: 'sort' })).toBe('a → b → c');
  });

  it('pairs match items with their left items', () => {
    expect(formatAnswer('x|y', { type: 'match', options: ['a', 'b'] })).toBe(
      'a → x, b → y',
    );
  });

  it('falls back to a bare chain when left items are missing or mismatched', () => {
    expect(formatAnswer('x|y', { type: 'match' })).toBe('x → y');
    expect(formatAnswer('x|y', { type: 'match', options: ['a'] })).toBe(
      'x → y',
    );
  });
});

describe('every question type scores through its answer format', () => {
  const CORRECT_PARTS: Record<AnswerKind, unknown> = {
    text: 'Queen',
    number: '7',
    choice: 'Queen',
    sort: ['a', 'b', 'c'],
    match: ['x', 'y', 'z'],
  };

  it.each(QUESTION_TYPES)('a correct %s answer is correct', (type) => {
    const kind = resolveAnswerKind({ type });
    const format = ANSWER_FORMATS[kind] as {
      encode: (parts: unknown) => string;
    };
    const answer = format.encode(CORRECT_PARTS[kind]);
    const question = { type, answer, points: 10 };
    if (isBatchGradedType(type)) {
      expect(gradeClosestGuessBatch(question, [answer])).toEqual([
        { points: 10, verdict: 'correct' },
      ]);
      expect(ANSWER_FORMATS[kind].score).toBeNull();
    } else {
      expect(scoreSubmission(question, answer)).toEqual({
        points: 10,
        verdict: 'correct',
      });
    }
  });

  it('only batch-graded types resolve to a kind without a score', () => {
    for (const type of QUESTION_TYPES) {
      const hasScore =
        ANSWER_FORMATS[resolveAnswerKind({ type })].score !== null;
      expect(hasScore).toBe(QUESTION_KINDS[type].gradingMode !== 'batch');
    }
  });
});
