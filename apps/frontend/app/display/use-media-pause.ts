import { useCallback, useEffect, useRef, type RefObject } from 'react';

const YOUTUBE_ORIGIN = 'https://www.youtube-nocookie.com';

type YoutubeCommand = 'pauseVideo' | 'playVideo';

function postYoutubeCommand(
  iframe: HTMLIFrameElement | null,
  func: YoutubeCommand,
): void {
  iframe?.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func, args: [] }),
    YOUTUBE_ORIGIN,
  );
}

interface MediaPauseHandles {
  youtubeRef: RefObject<HTMLIFrameElement | null>;
  /** Re-applies a standing pause once the embed has loaded — commands sent before then are dropped. */
  onYoutubeLoad: () => void;
  audioRef: RefObject<HTMLAudioElement | null>;
}

/**
 * Applies GameProgress.isMediaPaused to the question's YouTube iframe (via the
 * IFrame API's postMessage commands) and <audio> element without remounting
 * either. Resume only fires after a pause this hook applied, so a question
 * that never paused is never told to play (autoplay stays the setting's call).
 */
export function useMediaPause(isPaused: boolean): MediaPauseHandles {
  const youtubeRef = useRef<HTMLIFrameElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wasPausedRef = useRef(false);

  useEffect(() => {
    if (isPaused === wasPausedRef.current) return;
    wasPausedRef.current = isPaused;
    postYoutubeCommand(
      youtubeRef.current,
      isPaused ? 'pauseVideo' : 'playVideo',
    );
    const audio = audioRef.current;
    if (!audio) return;
    if (isPaused) {
      audio.pause();
    } else {
      // Browsers may reject play() (autoplay policy); the audio element's own
      // controls remain as the fallback, so there is nothing to do on failure.
      audio.play()?.catch(() => undefined);
    }
  }, [isPaused]);

  const onYoutubeLoad = useCallback(() => {
    if (isPaused) postYoutubeCommand(youtubeRef.current, 'pauseVideo');
  }, [isPaused]);

  return { youtubeRef, onYoutubeLoad, audioRef };
}
