import { describe, expect, it } from 'vitest';
import {
  MAX_MEDIA_UPLOAD_BYTES,
  classifyMediaUrl,
  isVideoUrl,
  resolveRevealClip,
  revealPlaysQuestionVideo,
} from '../media';

describe('MAX_MEDIA_UPLOAD_BYTES', () => {
  it('is five mebibytes', () => {
    expect(MAX_MEDIA_UPLOAD_BYTES).toBe(5_242_880);
  });
});

describe('revealPlaysQuestionVideo', () => {
  const YOUTUBE = 'https://youtu.be/dQw4w9WgXcQ';
  const FILE = 'https://cdn.example.com/clip.mp4';

  it.each([
    ['no answer media', YOUTUBE, undefined, true],
    ['a blank answer media', FILE, '', true],
    [
      'the same YouTube id',
      YOUTUBE,
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      true,
    ],
    ['the same file link', FILE, FILE, true],
    ['a different YouTube id', YOUTUBE, 'https://youtu.be/9bZkp7q19f0', false],
    ['a different file', FILE, 'https://cdn.example.com/other.mp4', false],
    ['an answer image', YOUTUBE, 'https://cdn.example.com/a.png', false],
    ['a question image', 'https://cdn.example.com/a.png', undefined, false],
    ['no question media', undefined, YOUTUBE, false],
  ])('%s', (_name, mediaUrl, answerMediaUrl, expected) => {
    expect(revealPlaysQuestionVideo({ mediaUrl, answerMediaUrl })).toBe(
      expected,
    );
  });
});

describe('resolveRevealClip', () => {
  const clipped = {
    mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
    mediaStartSeconds: 10,
    mediaEndSeconds: 20,
  };

  it('falls back to the question clip when both reveal times are blank', () => {
    expect(resolveRevealClip(clipped)).toEqual({ start: 10, end: 20 });
  });

  it('does not fill in a half-typed reveal clip', () => {
    expect(resolveRevealClip({ ...clipped, revealEndSeconds: 30 })).toEqual({
      start: undefined,
      end: 30,
    });
  });

  it('treats a reveal start of 0 as typed', () => {
    expect(resolveRevealClip({ ...clipped, revealStartSeconds: 0 })).toEqual({
      start: 0,
      end: undefined,
    });
  });

  it('leaves a different answer video whole', () => {
    expect(
      resolveRevealClip({
        ...clipped,
        answerMediaUrl: 'https://youtu.be/9bZkp7q19f0',
      }),
    ).toEqual({ start: undefined, end: undefined });
  });
});

describe('classifyMediaUrl', () => {
  it.each([
    ['https://cdn.example.com/clip.mp4', 'video-file'],
    ['https://cdn.example.com/clip.webm', 'video-file'],
    ['https://cdn.example.com/clip.mov', 'video-file'],
    ['https://cdn.example.com/clip.m4v', 'video-file'],
    ['https://cdn.example.com/CLIP.MP4', 'video-file'],
    ['http://cdn.example.com/clip.mp4?token=abc&x=1', 'video-file'],
    ['https://youtu.be/dQw4w9WgXcQ', 'youtube'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube'],
    ['https://cdn.example.com/song.mp3', 'audio'],
    ['https://cdn.example.com/song.M4A?x=1', 'audio'],
    ['https://cdn.example.com/photo.jpg', 'image'],
    ['https://cdn.example.com/no-extension', 'image'],
    ['data:video/mp4;base64,AAAA', undefined],
    ['javascript:alert(1)', undefined],
    ['clip.mp4', undefined],
    // The extension must end the path (or precede a query), not just appear in it.
    ['https://cdn.example.com/clip.mp4.png', 'image'],
    ['https://cdn.example.com/song.mp3.png', 'image'],
    // The scheme must start the link.
    ['see https://cdn.example.com/photo.png', undefined],
  ] as const)('classifies %s as %s', (url, expected) => {
    expect(classifyMediaUrl(url)).toBe(expected);
  });

  it('classifies undefined as no media', () => {
    expect(classifyMediaUrl(undefined)).toBeUndefined();
  });
});

describe('isVideoUrl', () => {
  it('is true for YouTube and video file links only', () => {
    expect(isVideoUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    expect(isVideoUrl('https://cdn.example.com/clip.mp4')).toBe(true);
    expect(isVideoUrl('https://cdn.example.com/song.mp3')).toBe(false);
    expect(isVideoUrl('https://cdn.example.com/photo.png')).toBe(false);
    expect(isVideoUrl(undefined)).toBe(false);
  });
});
