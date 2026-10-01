import { validateQuizDraft } from '@/quiz/quiz-draft.schema';
import {
  makeQuestion,
  makeRequest,
  makeRound,
} from '@/quiz/__tests__/quiz-draft-test-utils';

describe('validateQuizDraft - per-question-type field validation', () => {
  it('reports a closest_guess question with a non-numeric answer', () => {
    const issues = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({
            questions: [
              makeQuestion({ type: 'closest_guess', answer: 'a lot' }),
            ],
          }),
        ],
      }),
    );

    expect(issues).toContainEqual(expect.objectContaining({ field: 'answer' }));
  });

  it('reports a sort question whose answer is not a permutation of the options', () => {
    const issues = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({
            questions: [
              makeQuestion({
                type: 'sort',
                answer: 'Mercury|Venus',
                options: ['Venus', 'Mercury', 'Earth'],
              }),
            ],
          }),
        ],
      }),
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'answer',
      }),
    );
  });

  it('reports a sort question with fewer than two options', () => {
    const issues = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({
            questions: [
              makeQuestion({
                type: 'sort',
                answer: 'Mercury',
                options: ['Mercury'],
              }),
            ],
          }),
        ],
      }),
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'options',
      }),
    );
  });

  it('reports a match question whose left/right lists have different lengths', () => {
    const issues = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({
            questions: [
              makeQuestion({
                type: 'match',
                answer: 'excalibur',
                options: ['arthur', 'robin hood'],
                matchTargets: ['excalibur'],
              }),
            ],
          }),
        ],
      }),
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'matchTargets',
      }),
    );
  });

  it('reports a match question with a repeated right-hand item', () => {
    const issues = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({
            questions: [
              makeQuestion({
                type: 'match',
                answer: 'excalibur|excalibur',
                options: ['arthur', 'robin hood'],
                matchTargets: ['excalibur', 'excalibur'],
              }),
            ],
          }),
        ],
      }),
    );

    expect(issues).toContainEqual(
      expect.objectContaining({ questionIndex: 0, field: 'answer' }),
    );
  });

  it('reports a match question with a repeated left-hand item', () => {
    const issues = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({
            questions: [
              makeQuestion({
                type: 'match',
                answer: 'excalibur|bow',
                options: ['arthur', 'arthur'],
                matchTargets: ['excalibur', 'bow'],
              }),
            ],
          }),
        ],
      }),
    );

    expect(issues).toContainEqual(
      expect.objectContaining({ questionIndex: 0, field: 'options' }),
    );
  });

  it('reports a match answer that is not a permutation of the right-hand list', () => {
    const issues = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({
            questions: [
              makeQuestion({
                type: 'match',
                answer: 'shield|shield',
                options: ['arthur', 'robin hood'],
                matchTargets: ['excalibur', 'shield'],
              }),
            ],
          }),
        ],
      }),
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'answer',
      }),
    );
  });

  it('accepts a match question with an explicit matchScoringMode', () => {
    const issues = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({
            questions: [
              makeQuestion({
                type: 'match',
                answer: 'excalibur|shield',
                options: ['arthur', 'captain america'],
                matchTargets: ['shield', 'excalibur'],
                matchScoringMode: 'all_or_nothing',
              }),
            ],
          }),
        ],
      }),
    );

    expect(issues).toEqual([]);
  });

  it('reports a match question with an invalid matchScoringMode', () => {
    const issues = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({
            questions: [
              makeQuestion({
                type: 'match',
                answer: 'excalibur|shield',
                options: ['arthur', 'captain america'],
                matchTargets: ['shield', 'excalibur'],
                // @ts-expect-error deliberately invalid for this test
                matchScoringMode: 'half_credit',
              }),
            ],
          }),
        ],
      }),
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'matchScoringMode',
      }),
    );
  });

  it('reports a multiple choice question with fewer than two options', () => {
    const issues = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({
            questions: [
              makeQuestion({
                type: 'multiple_choice',
                answer: 'Paris',
                options: ['Paris'],
              }),
            ],
          }),
        ],
      }),
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'options',
      }),
    );
  });

  it('reports a multiple choice question with duplicate options', () => {
    const issues = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({
            questions: [
              makeQuestion({
                type: 'multiple_choice',
                answer: 'Paris',
                options: ['Paris', 'London', 'Paris'],
              }),
            ],
          }),
        ],
      }),
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'options',
      }),
    );
  });

  it('allows multiple choice options that differ only by case', () => {
    const issues = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({
            questions: [
              makeQuestion({
                type: 'multiple_choice',
                answer: 'Paris',
                options: ['Paris', 'paris'],
              }),
            ],
          }),
        ],
      }),
    );

    expect(issues).not.toContainEqual(
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'options',
      }),
    );
  });

  it('reports a multiple choice answer that is not one of the options', () => {
    const issues = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({
            questions: [
              makeQuestion({
                type: 'multiple_choice',
                answer: 'Berlin',
                options: ['Paris', 'London'],
              }),
            ],
          }),
        ],
      }),
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'answer',
      }),
    );
  });

  it('reports non-numeric, negative, and fractional points', () => {
    for (const points of [-1, 0, 1.5]) {
      const issues = validateQuizDraft(
        makeRequest({
          rounds: [makeRound({ questions: [makeQuestion({ points })] })],
        }),
      );

      expect(issues).toContainEqual(
        expect.objectContaining({
          roundIndex: 0,
          questionIndex: 0,
          field: 'points',
        }),
      );
    }
  });
});
