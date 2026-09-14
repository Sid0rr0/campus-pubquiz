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

  describe('kahootMode rounds', () => {
    it('allows a kahoot round whose questions are all auto-graded types', () => {
      const request = makeRequest({
        rounds: [
          makeRound({
            kahootMode: true,
            questions: [
              makeQuestion({
                type: 'multiple_choice',
                answer: 'Paris',
                options: ['Paris', 'London'],
              }),
              makeQuestion({
                type: 'sort',
                answer: 'Mercury|Venus',
                options: ['Venus', 'Mercury'],
              }),
              makeQuestion({
                type: 'match',
                answer: 'excalibur|shield',
                options: ['arthur', 'captain america'],
                matchTargets: ['shield', 'excalibur'],
              }),
            ],
          }),
        ],
      });

      expect(validateQuizDraft(request)).toEqual([]);
    });

    it.each(['free_text', 'audio', 'youtube', 'closest_guess'] as const)(
      'rejects a %s question in a kahoot round',
      (type) => {
        const overrides =
          type === 'audio'
            ? { mediaUrl: 'https://example.com/song.mp3' }
            : type === 'youtube'
              ? { mediaUrl: 'https://youtu.be/dQw4w9WgXcQ' }
              : type === 'closest_guess'
                ? { answer: '1000' }
                : {};
        const issues = validateQuizDraft(
          makeRequest({
            rounds: [
              makeRound({
                kahootMode: true,
                questions: [makeQuestion({ type, ...overrides })],
              }),
            ],
          }),
        );

        expect(issues).toContainEqual(
          expect.objectContaining({
            roundIndex: 0,
            questionIndex: 0,
            field: 'type',
          }),
        );
      },
    );

    it('does not restrict question types in a non-kahoot round', () => {
      const request = makeRequest({
        rounds: [
          makeRound({
            kahootMode: false,
            questions: [makeQuestion({ type: 'free_text' })],
          }),
        ],
      });

      expect(validateQuizDraft(request)).toEqual([]);
    });

    it('rejects a non-boolean kahootMode value from a malformed request body', () => {
      const request = makeRequest({
        rounds: [
          makeRound({
            kahootMode: 'yes' as unknown as boolean,
            questions: [
              makeQuestion({
                type: 'multiple_choice',
                answer: 'Paris',
                options: ['Paris', 'London'],
              }),
            ],
          }),
        ],
      });

      expect(validateQuizDraft(request)).toContainEqual(
        expect.objectContaining({
          roundIndex: 0,
          questionIndex: null,
          field: 'kahootMode',
        }),
      );
    });
  });
});
