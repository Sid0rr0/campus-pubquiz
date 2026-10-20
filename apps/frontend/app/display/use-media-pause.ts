import { useCallback, useEffect, useRef, type RefObject } from 'react';

const YOUTUBE_ORIGIN = 'https://www.youtube-nocookie.com';

type YoutubeCommand = 'pauseVideo' | 'playVideo' | 'mute' | 'unMute';

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
  /** Re-applies a standing pause once a (re)mounted <video> has loaded — it would otherwise autoplay. */
  onVideoReady: () => void;
}

/**
 * Applies GameProgress.isMediaPaused to the question's YouTube iframe (via the
 * IFrame API's postMessage commands), <audio> and <video> elements without
 * remounting any of them. Resume only fires after a pause this hook applied,
 * so a question that never paused is never told to play (autoplay stays the
 * setting's call).
 *
 * `isMuted` (the snapshot's isDisplaySoundMuted) mutes the same
 * elements in place: `muted` on <audio>/<video>, `mute`/`unMute` to YouTube.
 * Playback keeps going, so unmuting resumes the sound where the clip has got
 * to. It is independent of pause.
 *
 * A change of `replayToken` (Play again) on a <video> file seeks it to
 * `clipStart` and plays, in place. YouTube replays by remounting instead.
 */
export function useMediaPause(
  isPaused: boolean,
  replayToken = 0,
  clipStart = 0,
  isMuted = false,
): MediaPauseHandles {
  const youtubeRef = useRef<HTMLIFrameElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wasPausedRef = useRef(false);
  const wasMutedRef = useRef(false);
  const lastReplayTokenRef = useRef(replayToken);

  useEffect(() => {
    if (replayToken === lastReplayTokenRef.current) return;
    lastReplayTokenRef.current = replayToken;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = clipStart;
    video.play()?.catch(() => undefined);
  }, [replayToken, clipStart]);

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

  useEffect(() => {
    if (isMuted === wasMutedRef.current) return;
    wasMutedRef.current = isMuted;
    postYoutubeCommand(youtubeRef.current, isMuted ? 'mute' : 'unMute');
  }, [isMuted]);

  // No dependency list: <audio> and <video> remount with a new question, Play
  // again or the reveal, and a standing mute must reach each new element.
  useEffect(() => {
    for (const element of [audioRef.current, videoRef.current]) {
      if (element && element.muted !== isMuted) element.muted = isMuted;
    }
  });

  const onYoutubeLoad = useCallback(() => {
    if (isPaused) postYoutubeCommand(youtubeRef.current, 'pauseVideo');
    if (isMuted) postYoutubeCommand(youtubeRef.current, 'mute');
  }, [isPaused, isMuted]);

  const onVideoReady = useCallback(() => {
    if (isPaused) videoRef.current?.pause();
  }, [isPaused]);

  return { youtubeRef, onYoutubeLoad, audioRef, videoRef, onVideoReady };
}
