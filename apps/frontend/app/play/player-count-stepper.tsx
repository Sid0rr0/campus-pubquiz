'use client';

import { useState } from 'react';
import {
  isValidPlayerCount,
  MAX_PLAYER_COUNT,
  MIN_PLAYER_COUNT,
  type AckResult,
} from '@campus-pubquiz/types';

/** Where the stepper starts for a team that hasn't reported a count yet. */
export const DEFAULT_PLAYER_COUNT = 4;

type SendStatus = 'idle' | 'sending' | 'saved' | 'failed';

interface PlayerCountStepperProps {
  /** The number the stepper opens on. */
  initialCount: number;
  /** Resolves to the server's verdict on the count. */
  onSend: (playerCount: number) => Promise<AckResult>;
  /** Called with the count once the server has acknowledged it. */
  onSaved?: (playerCount: number) => void;
}

const STEP_BUTTON_CLASS =
  'h-10 w-10 rounded-full border border-current/30 text-xl font-extrabold leading-none disabled:opacity-30';

/** A − / + stepper limited to 1–20 and a Send button that shows "Saved ✓" or a retry. */
export function PlayerCountStepper({
  initialCount,
  onSend,
  onSaved,
}: PlayerCountStepperProps) {
  const [count, setCount] = useState(initialCount);
  const [status, setStatus] = useState<SendStatus>('idle');

  function step(delta: number): void {
    setCount((current) =>
      isValidPlayerCount(current + delta) ? current + delta : current,
    );
    setStatus('idle');
  }

  async function send(): Promise<void> {
    setStatus('sending');
    const result = await onSend(count);
    setStatus(result.success ? 'saved' : 'failed');
    if (result.success) onSaved?.(count);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Fewer players"
          disabled={count <= MIN_PLAYER_COUNT}
          onClick={() => step(-1)}
          className={STEP_BUTTON_CLASS}
        >
          −
        </button>
        <output
          aria-label="Number of players"
          className="w-10 text-center font-display text-3xl"
        >
          {count}
        </output>
        <button
          type="button"
          aria-label="More players"
          disabled={count >= MAX_PLAYER_COUNT}
          onClick={() => step(1)}
          className={STEP_BUTTON_CLASS}
        >
          +
        </button>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={status === 'sending'}
          onClick={() => void send()}
          className="rounded-lg border border-current/30 px-4 py-1.5 text-sm font-extrabold disabled:opacity-50"
        >
          {status === 'failed' ? 'Retry' : 'Send'}
        </button>
        {status === 'saved' && (
          <span className="text-xs font-extrabold opacity-70">Saved ✓</span>
        )}
        {status === 'failed' && (
          <span role="alert" className="text-xs font-extrabold text-magenta">
            Not saved — try again
          </span>
        )}
      </div>
    </div>
  );
}
