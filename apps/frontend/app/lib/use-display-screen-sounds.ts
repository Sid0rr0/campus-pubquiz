'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { DisplayScreen } from '@campus-pubquiz/types';
import { fireConfetti } from '@/app/lib/confetti';
import { displaySounds } from '@/app/lib/display-sounds';
import { soundFor } from '@/app/lib/display-sound-table';
import { useOnLiveForwardMove } from '@/app/lib/live-change';

export interface DisplayScreenFrame {
  screen: DisplayScreen;
  screenPosition: number;
}

/**
 * The big screen's one-off screen sounds: on a live forward move (the Screen
 * position grew on a connected display) it plays what the table says for the
 * move from the screen last seen to the current one. The fanfare also fires
 * confetti, and both are skipped when the final leaderboard already crowned a
 * winner live. The time-up that closes the joker pick also needs the countdown
 * sound setting on.
 */
export function useDisplayScreenSounds(
  frame: DisplayScreenFrame | null,
  isConnected: boolean,
  hasWinnerBeenCelebratedRef: RefObject<boolean>,
  isCountdownSoundOn: boolean,
): void {
  const screen = frame?.screen ?? null;
  const previousScreenRef = useRef<DisplayScreen | null>(null);

  useOnLiveForwardMove(frame?.screenPosition ?? 0, isConnected, () => {
    const previous = previousScreenRef.current;
    if (!previous || !screen) return;
    const sound = soundFor(previous, screen);
    if (!sound) return;
    // The joker pick's time-up closes a countdown, so the countdown sound
    // setting governs it with the countdown track.
    if (previous.kind === 'joker_pick' && !isCountdownSoundOn) return;
    if (sound === 'fanfare') {
      if (hasWinnerBeenCelebratedRef.current) return;
      fireConfetti();
    }
    displaySounds.play(sound);
  });

  // Declared after the live-change hook so its effect reads the screen from
  // before this render.
  useEffect(() => {
    previousScreenRef.current = screen;
  }, [screen]);
}
