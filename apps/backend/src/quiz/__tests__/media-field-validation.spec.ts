import { validateQuizDraft } from '@/quiz/quiz-draft.schema';
import {
  makeQuestion,
  makeRequest,
  makeRound,
} from '@/quiz/__tests__/quiz-draft-test-utils';

describe('validateQuizDraft - media field validation', () => {
  it('reports audio questions without a valid http(s) media url', () => {
    const missing = validateQuizDraft(
      makeRequest({
        rounds: [makeRound({ questions: [makeQuestion({ type: 'audio' })] })],
      }),
    );
    const invalid = validateQuizDraft(
      makeRequest({
        rounds: [
          makeRound({
            questions: [
              makeQuestion({
                type: 'audio',
                mediaUrl: 'ftp://example.com/x.mp3',
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
    expect(invalid).toContainEqual(
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'mediaUrl',
      }),
    );
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
});
