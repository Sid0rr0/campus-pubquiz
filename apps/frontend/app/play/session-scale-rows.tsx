import { useRef, useState } from 'react';
import {
  SESSION_SCALE_QUESTIONS,
  SESSION_SCALE_VALUE_LABELS,
  SESSION_SCALE_VALUES,
  type AckResult,
  type RateSessionPayload,
  type SessionScale,
  type SessionScaleValue,
  type TeamSessionRatingsView,
} from '@campus-pubquiz/types';

const SCALES = Object.keys(SESSION_SCALE_VALUES) as SessionScale[];

type RowStatus = 'idle' | 'saving' | 'saved' | 'failed';

interface RowState {
  value: SessionScaleValue | null;
  status: RowStatus;
}

interface SessionScaleRowsProps {
  /** The answers the server holds for this team; read once, so the owner remounts the rows when a new join payload replaces them. */
  saved: TeamSessionRatingsView;
  onRate: (rating: RateSessionPayload) => Promise<AckResult>;
}

/**
 * "How was the pace?" and "How hard were the questions?" at the top of the
 * final form: three buttons each, nothing chosen until the team taps one. A
 * tap saves at once and the row shows what the server said; an answer can be
 * changed but not cleared.
 */
export function SessionScaleRows({ saved, onRate }: SessionScaleRowsProps) {
  const [rows, setRows] = useState<Record<SessionScale, RowState>>(() => ({
    pacing: { value: saved.pacing, status: 'idle' },
    feltDifficulty: { value: saved.feltDifficulty, status: 'idle' },
  }));
  // Identifies the latest tap per scale, so a slow ack for an earlier tap
  // can't overwrite a newer one.
  const latestTapRef = useRef<Record<SessionScale, number>>({
    pacing: 0,
    feltDifficulty: 0,
  });

  async function rate(rating: RateSessionPayload): Promise<void> {
    const { scale, value } = rating;
    const tap = latestTapRef.current[scale] + 1;
    latestTapRef.current[scale] = tap;
    setRows((current) => ({
      ...current,
      [scale]: { value, status: 'saving' },
    }));
    const result = await onRate(rating);
    if (latestTapRef.current[scale] !== tap) return;
    setRows((current) => ({
      ...current,
      [scale]: { value, status: result.success ? 'saved' : 'failed' },
    }));
  }

  return (
    <div className="flex flex-col gap-3">
      {SCALES.map((scale) => (
        <ScaleRow
          key={scale}
          scale={scale}
          row={rows[scale]}
          onPick={(value) => void rate({ scale, value } as RateSessionPayload)}
        />
      ))}
    </div>
  );
}

interface ScaleRowProps {
  scale: SessionScale;
  row: RowState;
  onPick: (value: SessionScaleValue) => void;
}

function ScaleRow({ scale, row, onPick }: ScaleRowProps) {
  const labels: Record<string, string> = SESSION_SCALE_VALUE_LABELS[scale];
  const headingId = `session-scale-${scale}`;
  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="flex flex-col gap-1"
    >
      <div className="flex items-center gap-3">
        <span id={headingId} className="text-sm font-extrabold">
          {SESSION_SCALE_QUESTIONS[scale]}
        </span>
        {row.status === 'saved' && (
          <span className="text-xs font-extrabold text-foreground/55">
            Saved ✓
          </span>
        )}
        {row.status === 'failed' && (
          <span role="alert" className="text-xs font-extrabold text-magenta">
            Not saved — tap to retry
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {SESSION_SCALE_VALUES[scale].map((value) => {
          const isChosen = row.value === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isChosen}
              onClick={() => onPick(value)}
              className={`min-h-11 rounded-lg border-2 px-2 text-sm font-extrabold ${
                isChosen
                  ? 'border-magenta bg-magenta text-white'
                  : 'border-foreground/20'
              }`}
            >
              {labels[value]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
