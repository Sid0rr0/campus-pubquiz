import { validateQuizDraft } from '@/quiz/quiz-draft.schema';
import {
  makeQuestion,
  makeRequest,
  makeRound,
} from '@/quiz/__tests__/quiz-draft-test-utils';

describe('validateQuizDraft - media field validation', () => {
  it('reports a media url that is not http(s) on any question type', () => {
    const invalid = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({
            questions: [
              makeQuestion({
                type: 'free_text',
                mediaUrl: 'ftp://example.com/x.mp3',
              }),
            ],
          }),
        ],
      }),
    );

    expect(invalid).toContainEqual(
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'mediaUrl',
      }),
    );
  });

  it('accepts a question with no media url', () => {
    const issues = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({ questions: [makeQuestion({ type: 'free_text' })] }),
        ],
      }),
    );

    expect(issues).toEqual([]);
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
});
