import { describe, expect, it } from 'vitest';
import {
  extractYoutubeVideoId,
  formatTimecode,
  parseClipNotes,
  writeClipNotes,
} from '../youtube';

describe('extractYoutubeVideoId', () => {
  it('extracts the id from a standard watch URL', () => {
    // Arrange
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

    // Act
    const id = extractYoutubeVideoId(url);

    // Assert
    expect(id).toBe('dQw4w9WgXcQ');
  });

  it('extracts the id from a watch URL with extra query params before v=', () => {
    // Arrange
    const url = 'https://www.youtube.com/watch?list=PL123&v=dQw4w9WgXcQ&t=5s';

    // Act
    const id = extractYoutubeVideoId(url);

    // Assert
    expect(id).toBe('dQw4w9WgXcQ');
  });

  it('extracts the id from a youtu.be short link', () => {
    // Arrange
    const url = 'https://youtu.be/dQw4w9WgXcQ';

    // Act
    const id = extractYoutubeVideoId(url);

    // Assert
    expect(id).toBe('dQw4w9WgXcQ');
  });

  it('extracts the id from an embed URL', () => {
    // Arrange
    const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';

    // Act
    const id = extractYoutubeVideoId(url);

    // Assert
    expect(id).toBe('dQw4w9WgXcQ');
  });

  it('extracts the id from a shorts URL', () => {
    // Arrange
    const url = 'https://www.youtube.com/shorts/dQw4w9WgXcQ';

    // Act
    const id = extractYoutubeVideoId(url);

    // Assert
    expect(id).toBe('dQw4w9WgXcQ');
  });

  it('returns undefined for a non-YouTube URL', () => {
    // Arrange
    const url = 'https://example.com/landmark.jpg';

    // Act
    const id = extractYoutubeVideoId(url);

    // Assert
    expect(id).toBeUndefined();
  });
});

describe('parseClipNotes', () => {
  it('reads mm:ss start and end from a quoted group', () => {
    const result = parseClipNotes('{start: "1:22", end: "2:20"}');

    expect(result).toEqual({
      freeNotes: '',
      clip: { startSeconds: 82, endSeconds: 140 },
    });
  });

  it('reads the sample CSV group {start: "55", end: "88"}', () => {
    const result = parseClipNotes('{start: "55", end: "88"}');

    expect(result.clip).toEqual({ startSeconds: 55, endSeconds: 88 });
  });

  it('reads h:mm:ss times, unquoted', () => {
    const result = parseClipNotes('{start: 1:02:03, end: 1:05:00}');

    expect(result.clip).toEqual({ startSeconds: 3723, endSeconds: 3900 });
  });

  it('reads plain seconds over 99 and = separators', () => {
    const result = parseClipNotes("{start='173', end=200}");

    expect(result.clip).toEqual({ startSeconds: 173, endSeconds: 200 });
  });

  it('reads only start when end is missing', () => {
    const result = parseClipNotes('{start: "0:30"}');

    expect(result.clip).toEqual({ startSeconds: 30 });
  });

  it('reads revealStart, revealEnd and hideVideo', () => {
    const result = parseClipNotes(
      '{start: "0:10", revealStart: "1:00", revealEnd: "1:15", hideVideo: true}',
    );

    expect(result.clip).toEqual({
      startSeconds: 10,
      revealStartSeconds: 60,
      revealEndSeconds: 75,
      isVideoHidden: true,
    });
  });

  it('does not mistake revealStart for start', () => {
    const result = parseClipNotes('{revealStart: "0:40"}');

    expect(result.clip).toEqual({ revealStartSeconds: 40 });
  });

  it('does not set isVideoHidden for hideVideo: false', () => {
    const result = parseClipNotes('{start: "5", hideVideo: false}');

    expect(result.clip).toEqual({ startSeconds: 5 });
  });

  it('reads the legacy YouTube clip line and strips it with its prefix', () => {
    const result = parseClipNotes(
      'Play the chorus\nYouTube clip: {start: "1:22", end: "2:20"}',
    );

    expect(result).toEqual({
      freeNotes: 'Play the chorus',
      clip: { startSeconds: 82, endSeconds: 140 },
    });
  });

  it('keeps free notes before and after the group', () => {
    const result = parseClipNotes('Intro\n{start: "5"}\nOutro');

    expect(result).toEqual({
      freeNotes: 'Intro\nOutro',
      clip: { startSeconds: 5 },
    });
  });

  it('leaves notes without a clip group untouched', () => {
    const notes = 'Ask the audience if no one gets it in 10 seconds {maybe}';

    expect(parseClipNotes(notes)).toEqual({ freeNotes: notes, clip: {} });
  });

  it('treats a group with no readable timecode as free notes', () => {
    const notes = '{start: "soon"}';

    expect(parseClipNotes(notes)).toEqual({ freeNotes: notes, clip: {} });
  });

  it('reads undefined notes as empty', () => {
    expect(parseClipNotes(undefined)).toEqual({ freeNotes: '', clip: {} });
  });
});

describe('formatTimecode', () => {
  it.each([
    [55, '55'],
    [88, '1:28'],
    [60, '1:00'],
    [3723, '1:02:03'],
  ])('writes %i seconds as %s', (seconds, expected) => {
    expect(formatTimecode(seconds)).toBe(expected);
  });
});

describe('writeClipNotes', () => {
  it('returns the free notes unchanged when the clip is empty', () => {
    expect(writeClipNotes('Just notes', {})).toBe('Just notes');
  });

  it('appends the canonical group, leaving empty keys out', () => {
    expect(writeClipNotes('Hint', { startSeconds: 55, endSeconds: 88 })).toBe(
      'Hint\n{start: "55", end: "1:28"}',
    );
    expect(writeClipNotes('', { startSeconds: 10 })).toBe('{start: "10"}');
  });

  it('writes reveal keys and hideVideo', () => {
    expect(
      writeClipNotes('', {
        revealStartSeconds: 60,
        revealEndSeconds: 75,
        isVideoHidden: true,
      }),
    ).toBe('{revealStart: "1:00", revealEnd: "1:15", hideVideo: true}');
  });

  it('is read back identically by parseClipNotes', () => {
    const clip = {
      startSeconds: 55,
      endSeconds: 88,
      revealStartSeconds: 3723,
      isVideoHidden: true as const,
    };

    expect(parseClipNotes(writeClipNotes('Hint', clip))).toEqual({
      freeNotes: 'Hint',
      clip,
    });
  });
});
