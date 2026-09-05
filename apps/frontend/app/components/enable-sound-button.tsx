'use client';

import { SpeakerOffIcon } from '@radix-ui/react-icons';
import { Button } from '@/app/components/button';

interface EnableSoundButtonProps {
  onClick: () => void;
}

// One-time "tap to enable sound" affordance for the locking-countdown track —
// browsers block audio.play() until a real user gesture unlocks it, so each
// independently-connected tab (/display, /control) needs its own tap.
export function EnableSoundButton({ onClick }: EnableSoundButtonProps) {
  return (
    <Button
      type="button"
      variant="solid-flat"
      size="sm"
      onClick={onClick}
      className="fixed right-4 bottom-4 z-20 shadow-lg"
    >
      <SpeakerOffIcon aria-hidden="true" />
      Enable sound
    </Button>
  );
}
