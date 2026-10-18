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
  videoRef: RefObject<HTMLVideoElement | null>;
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wasPausedRef = useRef(false);

  useEffect(() => {
    if (isPaused === wasPausedRef.current) return;
    wasPausedRef.current = isPaused;
    postYoutubeCommand(
      youtubeRef.current,
      isPaused ? 'pauseVideo' : 'playVideo',
    );
    for (const element of [audioRef.current, videoRef.current]) {
      if (!element) continue;
      if (isPaused) {
        element.pause();
      } else {
        // Browsers may reject play() (autoplay policy); a rejection is ignored
        // and the moderator can pause/resume again.
        element.play()?.catch(() => undefined);
      }
    }
  }, [isPaused]);

  const onYoutubeLoad = useCallback(() => {
    if (isPaused) postYoutubeCommand(youtubeRef.current, 'pauseVideo');
  }, [isPaused]);

  return { youtubeRef, onYoutubeLoad, audioRef, videoRef };
}
