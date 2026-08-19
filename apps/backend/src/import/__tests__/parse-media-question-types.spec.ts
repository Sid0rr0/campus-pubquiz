import { parseQuestionRow } from '@/import/question-row.schema';
import { makeRow } from '@/import/__tests__/question-row-test-utils';

describe('parseQuestionRow - media question types', () => {
  it('rejects picture and audio rows without a valid http(s) media url', () => {
    for (const type of ['picture', 'audio']) {
      const missing = parseQuestionRow(makeRow({ type, mediaUrl: '' }));
      const invalid = parseQuestionRow(
        makeRow({ type, mediaUrl: 'ftp://example.com/x.mp3' }),
      );

      expect(missing.ok).toBe(false);
      expect(invalid.ok).toBe(false);
      if (!missing.ok) {
        expect(missing.issues).toContainEqual(
          expect.objectContaining({ field: 'media_url' }),
        );
      }
    }
  });

  it('accepts an audio row with a valid media url', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'audio',
        question: 'Name this song.',
        mediaUrl: 'https://example.com/song.mp3',
        answer: 'Bohemian Rhapsody',
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question.mediaUrl).toBe('https://example.com/song.mp3');
    }
  });

  it('accepts a youtube row with a youtube.com/youtu.be media url', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'youtube',
        question: 'Name this music video.',
        mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
        answer: 'Never Gonna Give You Up',
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question).toEqual(
        expect.objectContaining({
          type: 'youtube',
          mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
        }),
      );
    }
  });

  it('rejects a youtube row missing a media url or pointing at a non-YouTube url', () => {
    const missing = parseQuestionRow(
      makeRow({ type: 'youtube', mediaUrl: '' }),
    );
    const nonYoutube = parseQuestionRow(
      makeRow({ type: 'youtube', mediaUrl: 'https://example.com/video.mp4' }),
    );

    expect(missing.ok).toBe(false);
    expect(nonYoutube.ok).toBe(false);
    if (!nonYoutube.ok) {
      expect(nonYoutube.issues).toContainEqual(
        expect.objectContaining({ field: 'media_url' }),
      );
    }
  });

  it('accepts an optional answer_media_url on any question type, independent of media_url', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'free_text',
        question: 'Name this flag.',
        answer: 'France',
        answerMediaUrl: 'https://example.com/france-flag.jpg',
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question.answerMediaUrl).toBe(
        'https://example.com/france-flag.jpg',
      );
      expect(result.question.mediaUrl).toBeUndefined();
    }
  });

  it('rejects an invalid answer_media_url', () => {
    const result = parseQuestionRow(
      makeRow({ answerMediaUrl: 'ftp://example.com/x.jpg' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'answer_media_url' }),
      );
    }
  });
});
