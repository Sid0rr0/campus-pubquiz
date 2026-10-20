import { describe, expect, it } from 'vitest';
import { extractYoutubeVideoId, formatTimecode } from '../youtube';

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
