'use client';

import { Button } from '@/app/components/button';

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
      <span className="text-sm font-extrabold">Display sound</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="switch"
          aria-checked={!isMuted}
          aria-label="Display sound"
          onClick={() => onSetMuted(!isMuted)}
        >
          {isMuted ? 'Muted' : 'On'}
        </Button>
      </div>
    </div>
  );
}
