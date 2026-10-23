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
              type: 'free_text',
              answer: 'Bohemian Rhapsody',
              mediaUrl: 'https://example.com/song.mp3',
              answerMediaUrl: 'https://example.com/cover.jpg',
            }),
            makeQuestion({
              type: 'free_text',
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

    it.each(['free_text', 'closest_guess'] as const)(
      'rejects a %s question in a kahoot round',
      (type) => {
        const overrides = type === 'closest_guess' ? { answer: '1000' } : {};
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
            message:
              'Kahoot rounds only support multiple choice, sort / order, match pairs and number questions',
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

  describe('messages the editor shows', () => {
    it('words the quiz-level and round-level structural issues', () => {
      const issues = validateQuizDraft(
        makeRequest({
          title: ' ',
          rounds: [makeRound({ title: ' ', questions: [] })],
        }),
      );

      expect(issues).toEqual([
        {
          roundIndex: -1,
          questionIndex: null,
          field: 'title',
          message: 'Missing quiz title',
        },
        {
          roundIndex: 0,
          questionIndex: null,
          field: 'title',
          message: 'Missing round title',
        },
        {
          roundIndex: 0,
          questionIndex: null,
          field: 'questions',
          message: 'Round needs at least one question',
        },
      ]);
    });

    it('words the no-rounds issue', () => {
      expect(validateQuizDraft(makeRequest({ rounds: [] }))).toEqual([
        {
          roundIndex: -1,
          questionIndex: null,
          field: 'rounds',
          message: 'Quiz needs at least one round',
        },
      ]);
    });

    it('words the kahootMode issue', () => {
      const issues = validateQuizDraft(
        makeRequest({
          rounds: [makeRound({ kahootMode: 'yes' as unknown as boolean })],
        }),
      );

      expect(issues).toContainEqual({
        roundIndex: 0,
        questionIndex: null,
        field: 'kahootMode',
        message: 'Kahoot mode must be true or false',
      });
    });

    it('files an issue that has no field path under "question"', () => {
      const issues = validateQuizDraft(
        makeRequest({
          rounds: [
            makeRound({
              // A valid type on something that is not an object: zod fails at the root, with an empty path.
              questions: [
                Object.assign([], {
                  type: 'free_text',
                }) as unknown as ReturnType<typeof makeQuestion>,
              ],
            }),
          ],
        }),
      );

      expect(issues).toContainEqual(
        expect.objectContaining({
          roundIndex: 0,
          questionIndex: 0,
          field: 'question',
        }),
      );
    });
  });

  describe('round author, note and show-on-screen setting', () => {
    it('accepts a text author, a text note and a boolean setting', () => {
      const request = makeRequest({
        rounds: [
          makeRound({
            author: 'Sam',
            note: 'Say hi.',
            showNoteOnScreen: false,
          }),
        ],
      });

      expect(validateQuizDraft(request)).toEqual([]);
    });

    it('rejects an author that is not text', () => {
      const request = makeRequest({
        rounds: [makeRound({ author: 5 as unknown as string })],
      });

      expect(validateQuizDraft(request)).toEqual([
        {
          roundIndex: 0,
          questionIndex: null,
          field: 'author',
          message: 'Author must be text',
        },
      ]);
    });

    it('rejects a show-on-screen setting that is not a boolean', () => {
      const request = makeRequest({
        rounds: [makeRound({ showNoteOnScreen: 'yes' as unknown as boolean })],
      });

      expect(validateQuizDraft(request)).toEqual([
        {
          roundIndex: 0,
          questionIndex: null,
          field: 'showNoteOnScreen',
          message: 'Show on screen must be true or false',
        },
      ]);
    });

    it('rejects a note that is not text', () => {
      const request = makeRequest({
        rounds: [makeRound({ note: 5 as unknown as string })],
      });

      expect(validateQuizDraft(request)).toEqual([
        {
          roundIndex: 0,
          questionIndex: null,
          field: 'note',
          message: 'Round note must be text',
        },
      ]);
    });

    it('accepts a note of exactly 500 characters, ignoring surrounding whitespace', () => {
      const request = makeRequest({
        rounds: [makeRound({ note: `  ${'a'.repeat(500)}  ` })],
      });

      expect(validateQuizDraft(request)).toEqual([]);
    });

    it('rejects a note of 501 characters', () => {
      const request = makeRequest({
        rounds: [makeRound({ note: 'a'.repeat(501) })],
      });

      expect(validateQuizDraft(request)).toEqual([
        {
          roundIndex: 0,
          questionIndex: null,
          field: 'note',
          message: 'Round note must be at most 500 characters',
        },
      ]);
    });
  });

  describe('category', () => {
    it('accepts a category from the fixed list', () => {
      const request = makeRequest({
        rounds: [
          makeRound({
            category: 'Science & nature',
            questions: [makeQuestion({ type: 'free_text', answer: 'Jupiter' })],
          }),
        ],
      });

      expect(validateQuizDraft(request)).toEqual([]);
    });

    it('rejects a category that is not one of the fixed list', () => {
      const request = makeRequest({
        rounds: [
          makeRound({
            category: 'Sci-fi',
            questions: [makeQuestion({ type: 'free_text', answer: 'Jupiter' })],
          }),
        ],
      });

      expect(validateQuizDraft(request)).toContainEqual({
        roundIndex: 0,
        questionIndex: null,
        field: 'category',
        message:
          'Category must be one of: General knowledge, History, Geography, Science & nature, Sports, Music, Film & TV, Literature & books, Art & culture, News, Food & drink, Other',
      });
    });
  });
});
