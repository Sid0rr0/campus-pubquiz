import { useRef, useState } from 'react';
import type { AckResult, RatableRound } from '@campus-pubquiz/types';

const STAR_COUNT = 5;
const STARS = Array.from({ length: STAR_COUNT }, (_, index) => index + 1);
const HALF_STAR = 0.5;

type StarFill = 'full' | 'half' | 'empty';

type RowStatus = 'saving' | 'saved' | 'failed';

interface RowState {
  stars: number;
  status: RowStatus;
}

function rowsFromSaved(
  savedRatings: Readonly<Record<number, number>>,
): Record<number, RowState> {
  return Object.fromEntries(
    Object.entries(savedRatings).map(([roundId, stars]) => [
      roundId,
      { stars, status: 'saved' as const },
    ]),
  );
}

/**
 * The star rows' state, shared by the break card and the final form. A tap
 * saves at once and the row shows what the server said. `savedRatings` is read
 * once, so the page remounts the owner when a new join payload replaces them.
 */
export function useRoundRatings(
  savedRatings: Readonly<Record<number, number>>,
  onRate: (roundId: number, stars: number) => Promise<AckResult>,
) {
  const [rows, setRows] = useState(() => rowsFromSaved(savedRatings));
  // Identifies the latest tap per round, so a slow ack for an earlier tap
  // can't overwrite a newer one.
  const latestTapRef = useRef<Record<number, number>>({});

  function setRow(roundId: number, row: RowState): void {
    setRows((current) => ({ ...current, [roundId]: row }));
  }

  async function rate(roundId: number, stars: number): Promise<void> {
    const tap = (latestTapRef.current[roundId] ?? 0) + 1;
    latestTapRef.current[roundId] = tap;
    setRow(roundId, { stars, status: 'saving' });
    const result = await onRate(roundId, stars);
    if (latestTapRef.current[roundId] !== tap) return;
    setRow(roundId, {
      stars,
      status: result.success ? 'saved' : 'failed',
    });
  }

  return { rows, rate };
}

interface RoundStarRowsProps {
  rounds: readonly RatableRound[];
  rows: Readonly<Record<number, RowState>>;
  onRate: (roundId: number, stars: number) => void;
}

/** One star row per round, with "Saved ✓" / "Not saved — tap to retry" beside it. */
export function RoundStarRows({ rounds, rows, onRate }: RoundStarRowsProps) {
  return (
    <ul className="flex flex-col gap-3">
      {rounds.map((round) => {
        const row = rows[round.id];
        return (
          <li key={round.id} className="flex flex-col gap-1">
            <span className="text-sm font-extrabold">{round.title}</span>
            <div className="flex items-center gap-3">
              <div className="flex">
                {STARS.map((position) => (
                  <Star
                    key={position}
                    position={position}
                    roundTitle={round.title}
                    stars={row?.stars ?? 0}
                    onRate={(stars) => onRate(round.id, stars)}
                  />
                ))}
              </div>
              {row?.status === 'saved' && (
                <span className="text-xs font-extrabold text-foreground/55">
                  Saved ✓
                </span>
              )}
              {row?.status === 'failed' && (
                <span
                  role="alert"
                  className="text-xs font-extrabold text-magenta"
                >
                  Not saved — tap to retry
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function starFill(position: number, stars: number): StarFill {
  if (stars >= position) return 'full';
  if (stars >= position - HALF_STAR) return 'half';
  return 'empty';
}

/** The ratings one star offers: its left half is a half star, except on the first star, since a rating starts at 1. */
function starValues(position: number): number[] {
  return position === 1 ? [position] : [position - HALF_STAR, position];
}

const HALF_BUTTON_CLASSES = ['left-0 w-1/2', 'right-0 w-1/2'];

interface StarProps {
  position: number;
  roundTitle: string;
  stars: number;
  onRate: (stars: number) => void;
}

/** One star, drawn full, half or empty, with a tap target over each half. */
function Star({ position, roundTitle, stars, onRate }: StarProps) {
  const fill = starFill(position, stars);
  const values = starValues(position);

  return (
    <span className="relative flex h-11 w-11 items-center justify-center text-4xl leading-none">
      <span aria-hidden="true" className="relative">
        <span className="text-foreground/30">☆</span>
        {fill !== 'empty' && (
          <span
            className={`absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-magenta ${
              fill === 'half' ? 'w-1/2' : 'w-full'
            }`}
          >
            ★
          </span>
        )}
      </span>
      {values.map((value, index) => (
        <button
          key={value}
          type="button"
          aria-label={`Rate ${roundTitle} ${value} of ${STAR_COUNT}`}
          aria-pressed={value <= stars}
          onClick={() => onRate(value)}
          className={`absolute inset-y-0 ${
            values.length === 1 ? 'inset-x-0' : HALF_BUTTON_CLASSES[index]
          }`}
        />
      ))}
    </span>
  );
}
