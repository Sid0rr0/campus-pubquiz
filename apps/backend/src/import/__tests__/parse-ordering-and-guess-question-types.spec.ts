import { parseQuestionRow } from '@/import/question-row.schema';
import { makeRow } from '@/import/__tests__/question-row-test-utils';

describe('parseQuestionRow - sort, match, and closest_guess question types', () => {
  it('accepts a valid sort row and canonicalizes the answer order', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'sort',
        question: 'Order these planets from the sun outward.',
        options: 'Venus|Mercury|Earth',
        answer: 'Mercury | Venus |Earth',
      }),
    );

    expect(result).toEqual({
      ok: true,
      roundTitle: 'Round 1',
      roundBreakAfter: false,
      question: {
        type: 'sort',
        prompt: 'Order these planets from the sun outward.',
        answer: 'Mercury|Venus|Earth',
        points: 2,
        options: ['Venus', 'Mercury', 'Earth'],
      },
    });
  });

  it('rejects a sort answer that is not a permutation of the options', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'sort',
        options: 'Venus|Mercury|Earth',
        answer: 'Venus|Mercury',
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'answer' }),
      );
    }
  });

  it('rejects sort with fewer than two options', () => {
    const result = parseQuestionRow(
      makeRow({ type: 'sort', options: 'Venus', answer: 'Venus' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'options' }),
      );
    }
  });

  it('accepts a valid match row and canonicalizes the answer into left-list order', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'match',
        question: 'Match the hero to their weapon.',
        options: 'arthur|robin hood|captain america+excalibur|shield|bow',
        answer: 'arthur+excalibur|robin hood+bow|captain america+shield',
      }),
    );

    expect(result).toEqual({
      ok: true,
      roundTitle: 'Round 1',
      roundBreakAfter: false,
      question: {
        type: 'match',
        prompt: 'Match the hero to their weapon.',
        answer: 'excalibur|bow|shield',
        points: 2,
        options: ['arthur', 'robin hood', 'captain america'],
        matchTargets: ['excalibur', 'shield', 'bow'],
      },
    });
  });

  it('rejects a match row whose left/right lists have different lengths', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'match',
        options: 'arthur|robin hood+excalibur',
        answer: 'arthur+excalibur',
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'options' }),
      );
    }
  });

  it('rejects a match answer that pairs a left item with a right item not in the list', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'match',
        options: 'arthur|robin hood+excalibur|bow',
        answer: 'arthur+shield|robin hood+bow',
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'answer' }),
      );
    }
  });

  it('rejects a match answer that reuses the same right item twice', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'match',
        options: 'arthur|robin hood+excalibur|bow',
        answer: 'arthur+excalibur|robin hood+excalibur',
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'answer' }),
      );
    }
  });

  it('rejects a match row missing the "+" left/right divider in options', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'match',
        options: 'arthur|robin hood',
        answer: 'arthur+excalibur',
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'match_right' }),
      );
    }
  });

  it('accepts a valid closest_guess row with a numeric answer', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'closest_guess',
        question: 'How many students attend this university?',
        answer: '1000',
        points: '5',
      }),
    );

    expect(result).toEqual({
      ok: true,
      roundTitle: 'Round 1',
      roundBreakAfter: false,
      question: {
        type: 'closest_guess',
        prompt: 'How many students attend this university?',
        answer: '1000',
        points: 5,
      },
    });
  });

  it('rejects a closest_guess row with a non-numeric answer', () => {
    const result = parseQuestionRow(
      makeRow({ type: 'closest_guess', answer: 'a lot' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'answer' }),
      );
    }
  });

  it('rejects a closest_guess row with a blank answer', () => {
    const result = parseQuestionRow(
      makeRow({ type: 'closest_guess', answer: '' }),
    );

    expect(result.ok).toBe(false);
  });
});
