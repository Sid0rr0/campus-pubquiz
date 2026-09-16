import { parseQuestionRow } from '@/import/question-row.schema';
import { makeRow } from '@/import/__tests__/question-row-test-utils';

describe('parseQuestionRow - multiple choice and common fields', () => {
  it('accepts a valid multiple choice row and splits pipe-separated options', () => {
    // Arrange
    const row = makeRow({
      type: 'multiple_choice',
      question: 'Capital of France?',
      options: 'Paris|London|Berlin|Rome',
      answer: 'Paris',
    });

    // Act
    const result = parseQuestionRow(row);

    // Assert
    expect(result).toEqual({
      ok: true,
      roundTitle: 'Round 1',
      roundBreakAfter: false,
      question: {
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        answer: 'Paris',
        points: 2,
        options: ['Paris', 'London', 'Berlin', 'Rome'],
      },
    });
  });

  it('normalizes type spelling variants like "Multiple Choice"', () => {
    const row = makeRow({
      type: ' Multiple Choice ',
      options: 'Paris|London',
      answer: 'Paris',
    });

    const result = parseQuestionRow(row);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question.type).toBe('multiple_choice');
    }
  });

  it('defaults empty points to 1', () => {
    const result = parseQuestionRow(makeRow({ points: '' }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question.points).toBe(1);
    }
  });

  it('rejects an unknown question type', () => {
    const result = parseQuestionRow(makeRow({ type: 'karaoke' }));

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          rowNumber: 2,
          field: 'type',
          message: expect.stringContaining('karaoke') as string,
        },
      ],
    });
  });

  it('rejects a missing answer', () => {
    const result = parseQuestionRow(makeRow({ answer: '  ' }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ rowNumber: 2, field: 'answer' }),
      );
    }
  });

  it('rejects a multiple choice answer that is not one of the options', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'multiple_choice',
        options: 'Paris|London',
        answer: 'Berlin',
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'answer' }),
      );
    }
  });

  it('rejects multiple choice with fewer than two options', () => {
    const result = parseQuestionRow(
      makeRow({ type: 'multiple_choice', options: 'Paris', answer: 'Paris' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'options' }),
      );
    }
  });

  it('rejects non-numeric, negative, and fractional points', () => {
    for (const points of ['abc', '-1', '0', '1.5']) {
      const result = parseQuestionRow(makeRow({ points }));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toContainEqual(
          expect.objectContaining({ field: 'points' }),
        );
      }
    }
  });

  it('resolves break_after "1" to roundBreakAfter true, and "0"/blank to false', () => {
    for (const [breakAfter, expected] of [
      ['1', true],
      ['0', false],
      ['', false],
    ] as const) {
      const result = parseQuestionRow(makeRow({ breakAfter }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.roundBreakAfter).toBe(expected);
      }
    }
  });

  it('rejects an invalid break_after value', () => {
    const result = parseQuestionRow(makeRow({ breakAfter: 'yes' }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'break_after' }),
      );
    }
  });

  it('rejects a row with an empty round name', () => {
    const result = parseQuestionRow(makeRow({ round: '' }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'round' }),
      );
    }
  });

  it('collects multiple issues from one broken row', () => {
    const result = parseQuestionRow(
      makeRow({ question: '', answer: '', points: 'many' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.field).sort()).toEqual([
        'answer',
        'points',
        'question',
      ]);
    }
  });
});
