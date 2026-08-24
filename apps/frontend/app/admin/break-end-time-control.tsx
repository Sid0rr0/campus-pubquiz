'use client';

import { useState } from 'react';
import type { GameStatus } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';

interface BreakEndTimeControlProps {
  progressStatus: GameStatus;
  breakEndsAt: number | null;
  onSetBreakEndTime: (breakEndsAt: number | null) => void;
  className?: string;
}

const BREAK_STATUSES: GameStatus[] = [
  'break_intro',
  'break',
  'break_round_intro',
];

/** "21:45" — local time, for the <input type="time"> value. */
function toTimeInputValue(epochMs: number): string {
  const date = new Date(epochMs);
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

/**
 * "21:45" -> today's epoch-ms for that clock time, rolled to tomorrow if
 * it's already more than a minute in the past — so a break the admin starts
 * just before midnight can still target a post-midnight end time.
 */
function parseTimeInputValue(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const now = new Date();
  const candidate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    Number(match[1]),
    Number(match[2]),
  );
  if (candidate.getTime() < now.getTime() - 60_000) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.getTime();
}

/**
 * Lets the admin set/clear the "back at HH:MM" line shown on the display's
 * break screen — visible only during the break/grading statuses, since it's
 * meaningless anywhere else. Uncontrolled-ish: the input tracks its own text
 * while typing, seeded from `breakEndsAt` whenever that prop changes
 * (another admin tab, or a fresh break resetting it to null).
 */
export function BreakEndTimeControl({
  progressStatus,
  breakEndsAt,
  onSetBreakEndTime,
  className = '',
}: BreakEndTimeControlProps) {
  const [inputValue, setInputValue] = useState(
    breakEndsAt !== null ? toTimeInputValue(breakEndsAt) : '',
  );
  const [lastSeenBreakEndsAt, setLastSeenBreakEndsAt] = useState(breakEndsAt);

  if (breakEndsAt !== lastSeenBreakEndsAt) {
    setLastSeenBreakEndsAt(breakEndsAt);
    setInputValue(breakEndsAt !== null ? toTimeInputValue(breakEndsAt) : '');
  }

  if (!BREAK_STATUSES.includes(progressStatus)) {
    return null;
  }

  function handleSet(): void {
    const parsed = parseTimeInputValue(inputValue);
    if (parsed !== null) {
      onSetBreakEndTime(parsed);
    }
  }

  function handleClear(): void {
    setInputValue('');
    onSetBreakEndTime(null);
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-sm font-extrabold" htmlFor="break-end-time">
        Break ends at
      </label>
      <div className="flex items-center gap-2">
        <input
          id="break-end-time"
          type="time"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          className="min-h-10 rounded-lg border border-background/30 bg-transparent px-3 text-sm"
        />
        <Button variant="outline" size="sm" onClick={handleSet}>
          Set
        </Button>
        {breakEndsAt !== null && (
          <Button variant="text-quiet" onClick={handleClear}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
