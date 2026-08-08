import { describe, expect, it } from 'vitest';
import { extractYoutubeVideoId, parseYoutubeClipFromNotes } from './youtube';

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

describe('parseYoutubeClipFromNotes', () => {
  it('parses mm:ss start and end times from JSON-ish notes', () => {
    // Arrange
    const notes = '{start: "1:22", end: "2:20"}';

    // Act
    const clip = parseYoutubeClipFromNotes(notes);

    // Assert
    expect(clip).toEqual({ startSeconds: 82, endSeconds: 140 });
  });

  it('parses h:mm:ss times', () => {
    // Arrange
    const notes = 'start: 1:02:03, end: 1:05:00';

    // Act
    const clip = parseYoutubeClipFromNotes(notes);

    // Assert
    expect(clip).toEqual({ startSeconds: 3723, endSeconds: 3900 });
  });

  it('parses plain-seconds times', () => {
    // Arrange
    const notes = 'start=30 end=90';

    // Act
    const clip = parseYoutubeClipFromNotes(notes);

    // Assert
    expect(clip).toEqual({ startSeconds: 30, endSeconds: 90 });
  });

  it('returns only start when end is missing', () => {
    // Arrange
    const notes = '{start: "0:30"}';

    // Act
    const clip = parseYoutubeClipFromNotes(notes);

    // Assert
    expect(clip).toEqual({ startSeconds: 30 });
  });

  it('returns undefined for plain notes with no clip syntax', () => {
    // Arrange
    const notes = 'Ask the audience if no one gets it in 10 seconds';

    // Act
    const clip = parseYoutubeClipFromNotes(notes);

    // Assert
    expect(clip).toBeUndefined();
  });

  it('returns undefined for undefined notes', () => {
    // Act
    const clip = parseYoutubeClipFromNotes(undefined);

    // Assert
    expect(clip).toBeUndefined();
  });
});
