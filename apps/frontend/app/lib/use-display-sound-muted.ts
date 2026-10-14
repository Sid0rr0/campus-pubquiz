'use client';

import { useEffect } from 'react';
import { displaySounds } from '@/app/lib/display-sounds';

/** Keeps the display sound registry in step with the session's mute setting. */
export function useDisplaySoundMuted(isMuted: boolean): void {
  useEffect(() => {
    displaySounds.setMuted(isMuted);
  }, [isMuted]);
}
