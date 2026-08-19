import { validateQuizDraft } from '@/quiz/quiz-draft.schema';
import {
  makeQuestion,
  makeRequest,
  makeRound,
} from '@/quiz/__tests__/quiz-draft-test-utils';

describe('validateQuizDraft - valid draft and structural fields', () => {
  it('returns no issues for a valid draft with every question type', () => {
    const request = makeRequest({
      rounds: [
        makeRound({
          questions: [
            makeQuestion({ type: 'free_text', answer: 'Jupiter' }),
            makeQuestion({
              type: 'multiple_choice',
              answer: 'Paris',
              options: ['Paris', 'London', 'Berlin'],
            }),
            makeQuestion({
              type: 'picture',
              answer: 'Eiffel Tower',
              mediaUrl: 'https://example.com/eiffel.jpg',
            }),
            makeQuestion({
              type: 'audio',
              answer: 'Bohemian Rhapsody',
              mediaUrl: 'https://example.com/song.mp3',
              answerMediaUrl: 'https://example.com/cover.jpg',
            }),
            makeQuestion({
              type: 'youtube',
              answer: 'Never Gonna Give You Up',
              mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
            }),
            makeQuestion({
              type: 'sort',
              answer: 'Mercury|Venus|Earth',
              options: ['Venus', 'Mercury', 'Earth'],
            }),
            makeQuestion({
              type: 'match',
              answer: 'excalibur|shield',
              options: ['arthur', 'captain america'],
              matchTargets: ['shield', 'excalibur'],
            }),
            makeQuestion({
              type: 'closest_guess',
              answer: '1000',
            }),
          ],
        }),
      ],
    });

    expect(validateQuizDraft(request)).toEqual([]);
  });

  it('reports a missing quiz title', () => {
    const issues = validateQuizDraft(makeRequest({ title: '  ' }));

    expect(issues).toContainEqual(
      expect.objectContaining({
        roundIndex: -1,
        questionIndex: null,
        field: 'title',
      }),
    );
  });

  it('reports a quiz with no rounds', () => {
    const issues = validateQuizDraft(makeRequest({ rounds: [] }));

    expect(issues).toContainEqual(
      expect.objectContaining({
        roundIndex: -1,
        questionIndex: null,
        field: 'rounds',
      }),
    );
  });

  it('reports a round with a missing title', () => {
    const issues = validateQuizDraft(
      makeRequest({ rounds: [makeRound({ title: '' })] }),
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: null,
        field: 'title',
      }),
    );
  });

  it('reports a round with no questions', () => {
    const issues = validateQuizDraft(
      makeRequest({ rounds: [makeRound({ questions: [] })] }),
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: null,
        field: 'questions',
      }),
    );
  });

  it('reports a question with a missing prompt', () => {
    const issues = validateQuizDraft(
      makeRequest({
        rounds: [makeRound({ questions: [makeQuestion({ prompt: '' })] })],
      }),
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'prompt',
      }),
    );
  });

  it('collects issues across multiple rounds and questions', () => {
    const issues = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({ title: '', questions: [makeQuestion({ prompt: '' })] }),
          makeRound({ questions: [makeQuestion({ answer: '' })] }),
        ],
      }),
    );

    expect(issues).toContainEqual(
      expect.objectContaining({ roundIndex: 0, field: 'title' }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'prompt',
      }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        roundIndex: 1,
        questionIndex: 0,
        field: 'answer',
      }),
    );
  });
});
