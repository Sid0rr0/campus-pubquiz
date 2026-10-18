import { parseQuestionRow } from '@/import/question-row.schema';
import { makeRow } from '@/import/__tests__/question-row-test-utils';

describe('parseQuestionRow - media on any question type', () => {
  it.each(['audio', 'Audio', 'youtube', ' YouTube '])(
    'rejects the removed type %j with a message naming the replacement',
    (type) => {
      const result = parseQuestionRow(
        makeRow({ type, mediaUrl: 'https://example.com/song.mp3' }),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual([
          expect.objectContaining({
            field: 'type',
            message: `Question type "${type.trim()}" was removed — use free_text (or multiple_choice if the row has options) and keep the media_url.`,
          }),
        ]);
      }
    },
  );

  it('still gives the generic message for any other unknown type', () => {
    const result = parseQuestionRow(makeRow({ type: 'video' }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].message).toContain('Unknown question type');
    }
  });

  it('accepts a free_text row with an mp3 media url', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'free_text',
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

  it('accepts a multiple_choice row with a youtube url, clip, reveal clip and hidden video', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'multiple_choice',
        question: 'Name this music video.',
        options: 'Never Gonna Give You Up|Africa',
        mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
        answer: 'Never Gonna Give You Up',
        notes:
          '{start: "0:10", end: "0:25", revealStart: "0:43", revealEnd: "0:58", hideVideo: true}',
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question).toEqual(
        expect.objectContaining({
          type: 'multiple_choice',
          mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
          mediaStartSeconds: 10,
          mediaEndSeconds: 25,
          revealStartSeconds: 43,
          revealEndSeconds: 58,
          isVideoHidden: true,
        }),
      );
    }
  });

  it('rejects a row whose clip time in the notes is not a timecode, naming the notes column', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'free_text',
        mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
        answer: 'Never Gonna Give You Up',
        notes: '{start: "1:2x"}',
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].field).toBe('notes');
      expect(result.issues[0].message).toContain('"start"');
    }
  });

  it('rejects a media url that is not http(s)', () => {
    const result = parseQuestionRow(
      makeRow({ type: 'free_text', mediaUrl: 'ftp://example.com/x.mp3' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
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
