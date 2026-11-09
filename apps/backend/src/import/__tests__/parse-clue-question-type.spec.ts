import { parseQuestionRow } from '@/import/question-row.schema';
import { makeRow } from '@/import/__tests__/question-row-test-utils';

describe('parseQuestionRow - clue questions', () => {
  it('reads the clues from the options cell and derives the points whatever the sheet says', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'clues',
        question: 'Who am I?',
        options: 'Born 1879 | Wrote on relativity | E=mc2',
        answer: 'Einstein',
        points: '9',
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      question: {
        type: 'clues',
        options: ['Born 1879', 'Wrote on relativity', 'E=mc2'],
        answer: 'Einstein',
        points: 1.5,
      },
    });
  });

  it('derives the points even when the points cell is blank', () => {
    const result = parseQuestionRow(
      makeRow({ type: 'clues', options: 'a|b|c|d|e', answer: 'X', points: '' }),
    );

    expect(result).toMatchObject({ ok: true, question: { points: 2.5 } });
  });

  it('refuses a single clue on the options column', () => {
    const result = parseQuestionRow(
      makeRow({ type: 'clues', options: 'only one', answer: 'X' }),
    );

    expect(result).toMatchObject({
      ok: false,
      issues: [{ field: 'options', message: 'Provide at least 2 clues' }],
    });
  });

  it('is not allowed in a quickfire quiz', () => {
    const result = parseQuestionRow(
      makeRow({ type: 'clues', options: 'a|b', answer: 'X' }),
      'quickfire',
    );

    expect(result.ok).toBe(false);
  });
});
