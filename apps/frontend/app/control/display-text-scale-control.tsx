'use client';

import {
  DEFAULT_DISPLAY_TEXT_SCALE,
  DISPLAY_TEXT_SCALE_STEPS,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';

interface DisplayTextScaleControlProps {
  displayTextScale: number;
  onSetDisplayTextScale: (displayTextScale: number) => void;
  className?: string;
}

/**
 * Lets the admin grow/shrink every /display screen's text (except the
 * persistent header) — added after a projector run showed the fixed size
 * was too small on a big screen but too large on a laptop, so it's a live,
 * session-scoped knob rather than a fixed size. Always available, since it
 * applies across every screen /display can show.
 */
export function DisplayTextScaleControl({
  displayTextScale,
  onSetDisplayTextScale,
  className = '',
}: DisplayTextScaleControlProps) {
  const currentIndex = DISPLAY_TEXT_SCALE_STEPS.indexOf(
    displayTextScale as (typeof DISPLAY_TEXT_SCALE_STEPS)[number],
  );
  const canDecrease = currentIndex > 0;
  const canIncrease = currentIndex < DISPLAY_TEXT_SCALE_STEPS.length - 1;

  function stepTo(index: number): void {
    const nextScale = DISPLAY_TEXT_SCALE_STEPS[index];
    if (nextScale !== undefined) {
      onSetDisplayTextScale(nextScale);
    }
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-extrabold">Display text size</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Decrease display text size"
          disabled={!canDecrease}
          onClick={() => stepTo(currentIndex - 1)}
        >
          A−
        </Button>
        <span
          className="min-w-12 text-center text-sm font-bold"
          aria-live="polite"
        >
          {Math.round(displayTextScale * 100)}%
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Increase display text size"
          disabled={!canIncrease}
          onClick={() => stepTo(currentIndex + 1)}
        >
          A+
        </Button>
        {displayTextScale !== DEFAULT_DISPLAY_TEXT_SCALE && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSetDisplayTextScale(DEFAULT_DISPLAY_TEXT_SCALE)}
          >
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
