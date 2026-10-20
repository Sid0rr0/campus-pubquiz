'use client';

import { SpeakerLoudIcon, SpeakerOffIcon } from '@radix-ui/react-icons';
import { Button } from '@/app/components/button';
import { ADMIN_SHORTCUTS } from '@/app/control/admin-keyboard-shortcuts';

interface DisplaySoundMuteControlProps {
  isMuted: boolean;
  onSetMuted: (isMuted: boolean) => void;
  className?: string;
}

/**
 * Lets the admin silence the big screen (e.g. during a speech) without
 * walking to the display PC. Session-scoped, like the display text size.
 */
export function DisplaySoundMuteControl({
  isMuted,
  onSetMuted,
  className = '',
}: DisplaySoundMuteControlProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-w-24"
          role="switch"
          aria-checked={!isMuted}
          aria-label="Display sound"
          title={`Mute or unmute the big screen (${ADMIN_SHORTCUTS.toggleDisplayMute.keyName})`}
          onClick={() => onSetMuted(!isMuted)}
        >
          {isMuted ? (
            <SpeakerOffIcon aria-hidden="true" />
          ) : (
            <SpeakerLoudIcon aria-hidden="true" />
          )}
          {isMuted ? 'Muted' : 'On'}
        </Button>
      </div>
    </div>
  );
}
