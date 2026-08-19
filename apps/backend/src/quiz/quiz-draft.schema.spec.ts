import type {
  ImportQuestionPreview,
  ImportRoundPreview,
  QuizDraftSaveRequest,
} from '@campus-pubquiz/types';
import { validateQuizDraft } from '@/quiz/quiz-draft.schema';

function makeQuestion(
  overrides: Partial<ImportQuestionPreview> = {},
): ImportQuestionPreview {
  return {
    type: 'free_text',
    prompt: 'Largest planet?',
    answer: 'Jupiter',
    points: 2,
    ...overrides,
  };
}

function makeRound(
  overrides: Partial<ImportRoundPreview> = {},
): ImportRoundPreview {
  return {
    title: 'Round 1',
    breakAfter: true,
    questions: [makeQuestion()],
    ...overrides,
  };
}

function makeRequest(
  overrides: Partial<QuizDraftSaveRequest> = {},
): QuizDraftSaveRequest {
  return {
    title: 'Trivia Night',
    rounds: [makeRound()],
    ...overrides,
  };
}

describe('validateQuizDraft', () => {
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

  it('reports picture and audio questions without a valid http(s) media url', () => {
    for (const type of ['picture', 'audio'] as const) {
      const missing = validateQuizDraft(
        makeRequest({
          rounds: [makeRound({ questions: [makeQuestion({ type })] })],
        }),
      );
      const invalid = validateQuizDraft(
        makeRequest({
          rounds: [
            makeRound({
              questions: [
                makeQuestion({ type, mediaUrl: 'ftp://example.com/x.mp3' }),
              ],
            }),
          ],
        }),
      );

      expect(missing).toContainEqual(
        expect.objectContaining({
          roundIndex: 0,
          questionIndex: 0,
          field: 'mediaUrl',
        }),
      );
      expect(invalid).toContainEqual(
        expect.objectContaining({
          roundIndex: 0,
          questionIndex: 0,
          field: 'mediaUrl',
        }),
      );
    }
  });

  it('reports a youtube question missing a media url or pointing at a non-YouTube url', () => {
    const missing = validateQuizDraft(
      makeRequest({
        rounds: [makeRound({ questions: [makeQuestion({ type: 'youtube' })] })],
      }),
    );
    const nonYoutube = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({
            questions: [
              makeQuestion({
                type: 'youtube',
                mediaUrl: 'https://example.com/video.mp4',
              }),
            ],
          }),
        ],
      }),
    );

    expect(missing).toContainEqual(
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'mediaUrl',
      }),
    );
    expect(nonYoutube).toContainEqual(
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'mediaUrl',
      }),
    );
  });

  it('reports an invalid answer media url on any question type', () => {
    const issues = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({
            questions: [
              makeQuestion({ answerMediaUrl: 'ftp://example.com/x.jpg' }),
            ],
          }),
        ],
      }),
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'answerMediaUrl',
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
