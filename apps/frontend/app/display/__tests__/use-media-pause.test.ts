import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMediaPause } from '@/app/display/use-media-pause';

function fakeIframe() {
  const postMessage = vi.fn();
  const iframe = {
    contentWindow: { postMessage },
  } as unknown as HTMLIFrameElement;
  return { iframe, postMessage };
}

function commandsSent(postMessage: ReturnType<typeof vi.fn>): string[] {
  return postMessage.mock.calls.map(
    ([message]) => (JSON.parse(message as string) as { func: string }).func,
  );
}

/** A media element whose play() returns nothing, as in browsers without a promise. */
function fakeMedia() {
  return {
    muted: false,
    pause: vi.fn(),
    play: vi.fn(() => undefined),
    currentTime: 0,
  };
}

describe('useMediaPause', () => {
  it('leaves media unmuted when no mute flag is given', () => {
    const { result, rerender } = renderHook(() => useMediaPause(false));
    const audio = fakeMedia();
    result.current.audioRef.current = audio as unknown as HTMLAudioElement;
    rerender();
    expect(audio.muted).toBe(false);
  });

  it('mutes a media element that appears after a standing mute', () => {
    const { result, rerender } = renderHook(() =>
      useMediaPause(false, 0, 0, true),
    );
    const audio = fakeMedia();
    result.current.audioRef.current = audio as unknown as HTMLAudioElement;
    rerender();
    expect(audio.muted).toBe(true);
  });

  it('tolerates play() returning nothing when resuming', () => {
    const { result, rerender } = renderHook(
      ({ paused }) => useMediaPause(paused),
      { initialProps: { paused: true } },
    );
    const audio = fakeMedia();
    result.current.audioRef.current = audio as unknown as HTMLAudioElement;
    expect(() => rerender({ paused: false })).not.toThrow();
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it('tolerates play() returning nothing on a replay', () => {
    const { result, rerender } = renderHook(
      ({ token }) => useMediaPause(false, token, 12),
      { initialProps: { token: 0 } },
    );
    const video = fakeMedia();
    result.current.videoRef.current = video as unknown as HTMLVideoElement;
    expect(() => rerender({ token: 1 })).not.toThrow();
    expect(video.currentTime).toBe(12);
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  describe('onYoutubeLoad', () => {
    it('sends nothing when the game is neither paused nor muted', () => {
      const { result } = renderHook(() => useMediaPause(false, 0, 0, false));
      const { iframe, postMessage } = fakeIframe();
      result.current.youtubeRef.current = iframe;
      result.current.onYoutubeLoad();
      expect(postMessage).not.toHaveBeenCalled();
    });

    it('re-sends a pause that began after the first render', () => {
      const { result, rerender } = renderHook(
        ({ paused }) => useMediaPause(paused),
        { initialProps: { paused: false } },
      );
      const { iframe, postMessage } = fakeIframe();
      result.current.youtubeRef.current = iframe;
      rerender({ paused: true });
      postMessage.mockClear();
      result.current.onYoutubeLoad();
      expect(commandsSent(postMessage)).toEqual(['pauseVideo']);
    });

    it('re-sends a mute that began after the first render', () => {
      const { result, rerender } = renderHook(
        ({ muted }) => useMediaPause(false, 0, 0, muted),
        { initialProps: { muted: false } },
      );
      const { iframe, postMessage } = fakeIframe();
      result.current.youtubeRef.current = iframe;
      rerender({ muted: true });
      postMessage.mockClear();
      result.current.onYoutubeLoad();
      expect(commandsSent(postMessage)).toEqual(['mute']);
    });
  });

  describe('onVideoReady', () => {
    it('does not pause a video when the game is not paused', () => {
      const { result } = renderHook(() => useMediaPause(false));
      const video = fakeMedia();
      result.current.videoRef.current = video as unknown as HTMLVideoElement;
      result.current.onVideoReady();
      expect(video.pause).not.toHaveBeenCalled();
    });

    it('pauses a video once a pause began after the first render', () => {
      const { result, rerender } = renderHook(
        ({ paused }) => useMediaPause(paused),
        { initialProps: { paused: false } },
      );
      const video = fakeMedia();
      result.current.videoRef.current = video as unknown as HTMLVideoElement;
      rerender({ paused: true });
      video.pause.mockClear();
      result.current.onVideoReady();
      expect(video.pause).toHaveBeenCalledTimes(1);
    });
  });
});
