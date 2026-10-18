import { describe, expect, it } from 'vitest';
import { classifyMediaUrl, isVideoUrl } from '../media';

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
