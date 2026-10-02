import { useRef, useState } from 'react';
import type { AckResult, RatableRound } from '@campus-pubquiz/types';

const STAR_COUNT = 5;
const STARS = Array.from({ length: STAR_COUNT }, (_, index) => index + 1);

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

export function isEveryRoundSaved(
  rounds: readonly RatableRound[],
  rows: Readonly<Record<number, RowState>>,
): boolean {
  return rounds.every((round) => rows[round.id]?.status === 'saved');
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
                {STARS.map((value) => {
                  const isFilled = value <= (row?.stars ?? 0);
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-label={`Rate ${round.title} ${value} of ${STAR_COUNT}`}
                      aria-pressed={isFilled}
                      onClick={() => onRate(round.id, value)}
                      className={`p-1 text-2xl leading-none ${
                        isFilled ? 'text-magenta' : 'text-foreground/30'
                      }`}
                    >
                      {isFilled ? '★' : '☆'}
                    </button>
                  );
                })}
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
