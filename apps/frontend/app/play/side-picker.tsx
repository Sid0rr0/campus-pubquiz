'use client';

import { useState } from 'react';
import {
  versusSideColor,
  type AckResult,
  type VersusSide,
} from '@campus-pubquiz/types';

/** The colour dot and name of a side, as the phone header and the picker show it. */
export function SideBadge({
  sides,
  sideId,
}: {
  sides: readonly VersusSide[];
  sideId: string;
}) {
  const index = sides.findIndex((side) => side.id === sideId);
  if (index === -1) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-0.5 text-xs font-extrabold">
      <span
        aria-hidden="true"
        className="size-2.5 rounded-full"
        style={{ backgroundColor: versusSideColor(index) }}
      />
      {sides[index].name}
    </span>
  );
}

/**
 * The phone's side picker: a card per side. Shown before anything else while
 * the team has no side, and reopened from the badge in the lobby to switch. It
 * covers this phone only; the quiz carries on underneath.
 */
export function SidePicker({
  sides,
  mySideId,
  onPick,
  onClose,
}: {
  sides: readonly VersusSide[];
  mySideId: string | null;
  onPick: (sideId: string) => Promise<AckResult>;
  /** Closes the picker; offered ("Back") only to a team that already has a side. */
  onClose: () => void;
}) {
  const [refusal, setRefusal] = useState<string | null>(null);

  async function pick(sideId: string) {
    const result = await onPick(sideId);
    if (result.success) {
      setRefusal(null);
      onClose();
    } else {
      setRefusal(result.error);
    }
  }

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-background px-5 pt-6 text-foreground">
      <h1 className="font-display text-2xl">Pick your side</h1>
      <p className="text-sm text-foreground/65">
        Your points count towards your side&apos;s average. You can switch until
        the quiz starts.
      </p>
      <ul className="flex flex-col gap-3">
        {sides.map((side, index) => (
          <li key={side.id}>
            <button
              type="button"
              aria-pressed={mySideId === side.id}
              onClick={() => void pick(side.id)}
              className="flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left"
              style={{
                borderColor: versusSideColor(index),
                backgroundColor:
                  mySideId === side.id
                    ? `${versusSideColor(index)}26`
                    : undefined,
              }}
            >
              <span
                aria-hidden="true"
                className="size-4 rounded-full"
                style={{ backgroundColor: versusSideColor(index) }}
              />
              <span className="font-display text-xl">{side.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {refusal && (
        <p role="alert" className="font-extrabold text-magenta">
          {refusal}
        </p>
      )}
      {mySideId !== null && (
        <button
          type="button"
          onClick={onClose}
          className="self-start text-sm font-extrabold text-foreground/65 underline"
        >
          Back
        </button>
      )}
    </main>
  );
}
