'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const LOCK_COUNTDOWN_TRACK_SECONDS = 60;
const LOCK_COUNTDOWN_SOUND_SRC = '/sounds/lock-countdown.mp3';

interface UseLockCountdownSoundOptions {
  /** Epoch-ms deadline when the question auto-locks, or null while no lock is armed. */
  lockAt: number | null;
  /** SessionSettings.playLockCountdownSound — sound never plays or primes when false. */
  enabled: boolean;
}

interface UseLockCountdownSoundResult {
  /** True until this tab's one-time "tap to enable sound" gesture has fired. */
  needsUnlock: boolean;
  /** Call synchronously from a button's onClick — primes the audio element via a real user gesture. */
  unlock: () => void;
}

// The track is authored as a 60s clip meant to end exactly at the lock
// deadline. Rather than reading the configured lock duration separately, the
// start offset is derived from the deadline itself: both the track's
// playback clock and the real-time countdown advance at 1x, so setting
// currentTime once from however much time is actually left (at mount or on
// reconnect) keeps the track's ending in sync with lockAt with no further
// resyncing needed — the same reconnect-resilience trick QuestionLockCountdown
// uses for its ring animation.
export function useLockCountdownSound({
  lockAt,
  enabled,
}: UseLockCountdownSoundOptions): UseLockCountdownSoundResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  function getAudio(): HTMLAudioElement {
    if (!audioRef.current) {
      audioRef.current = new Audio(LOCK_COUNTDOWN_SOUND_SRC);
    }
    return audioRef.current;
  }

  const unlock = useCallback(() => {
    // A throwaway element, not the shared one from getAudio() — this play()
    // call runs inside the real click handler (synchronous user gesture) so
    // the browser grants this tab permission to autoplay unmuted going
    // forward, but its priming .then(pause) must never touch the same
    // element the real countdown plays through: if unlock() is clicked
    // while the locking phase is already active (very plausible — someone
    // testing this right after starting a session), that pause could land
    // after the real playback has already started and silently cut it off.
    const primer = new Audio(LOCK_COUNTDOWN_SOUND_SRC);
    primer
      .play()
      .then(() => primer.pause())
      .catch(() => {});
    setUnlocked(true);
  }, []);

  useEffect(() => {
    if (!enabled || !unlocked || lockAt === null) {
      return;
    }
    const audio = getAudio();
    const secondsRemaining = Math.max(
      0,
      Math.ceil((lockAt - Date.now()) / 1000),
    );
    audio.currentTime = Math.max(
      0,
      LOCK_COUNTDOWN_TRACK_SECONDS - secondsRemaining,
    );
    audio.play().catch(() => {});
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [lockAt, enabled, unlocked]);

  return { needsUnlock: enabled && !unlocked, unlock };
}
