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
  /** Re-applies a standing pause or mute once the embed has loaded — commands sent before then are dropped — and starts a player remounted by Play again. */
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
 * A change of `replayToken` (Play again) seeks a <video> file to `clipStart`
 * and an <audio> to its beginning (a sound has no clip), then plays, in place.
 * YouTube replays by remounting instead.
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
  const mountedReplayToken = useRef(replayToken).current;

  const refs = { youtubeRef, audioRef, videoRef };
  useReplayFollowing(replayToken, clipStart, refs);
  usePauseFollowing(isPaused, refs);
  useMuteFollowing(isMuted, refs);

  const onYoutubeLoad = useCallback(() => {
    if (isPaused) postYoutubeCommand(youtubeRef.current, 'pauseVideo');
    // Play again remounted the embed, whose autoplay param follows the setting: the press itself must start it.
    else if (replayToken !== mountedReplayToken) {
      postYoutubeCommand(youtubeRef.current, 'playVideo');
    }
    if (isMuted) postYoutubeCommand(youtubeRef.current, 'mute');
  }, [isPaused, isMuted, replayToken, mountedReplayToken]);

  const onVideoReady = useCallback(() => {
    if (isPaused) videoRef.current?.pause();
  }, [isPaused]);

  return { youtubeRef, onYoutubeLoad, audioRef, videoRef, onVideoReady };
}

interface MediaRefs {
  youtubeRef: RefObject<HTMLIFrameElement | null>;
  audioRef: RefObject<HTMLAudioElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
}

/** Play again restarts the media element: a video from its clip, a sound from the top. */
function useReplayFollowing(
  replayToken: number,
  clipStart: number,
  { audioRef, videoRef }: MediaRefs,
) {
  const lastReplayTokenRef = useRef(replayToken);
  useEffect(() => {
    if (replayToken === lastReplayTokenRef.current) return;
    lastReplayTokenRef.current = replayToken;
    const video = videoRef.current;
    const element = video ?? audioRef.current;
    if (!element) return;
    element.currentTime = video ? clipStart : 0;
    element.play()?.catch(() => undefined);
  }, [replayToken, clipStart, audioRef, videoRef]);
}

function usePauseFollowing(
  isPaused: boolean,
  { youtubeRef, audioRef, videoRef }: MediaRefs,
) {
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
  }, [isPaused, youtubeRef, audioRef, videoRef]);
}

function useMuteFollowing(
  isMuted: boolean,
  { youtubeRef, audioRef, videoRef }: MediaRefs,
) {
  const wasMutedRef = useRef(false);
  useEffect(() => {
    if (isMuted === wasMutedRef.current) return;
    wasMutedRef.current = isMuted;
    postYoutubeCommand(youtubeRef.current, isMuted ? 'mute' : 'unMute');
  }, [isMuted, youtubeRef]);

  // No dependency list: <audio> and <video> remount with a new question, Play
  // again or the reveal, and a standing mute must reach each new element.
  useEffect(() => {
    for (const element of [audioRef.current, videoRef.current]) {
      // Stryker disable next-line ConditionalExpression: the guard only skips a write of the value already there; no observable difference
      if (element && element.muted !== isMuted) element.muted = isMuted;
    }
  });
}
