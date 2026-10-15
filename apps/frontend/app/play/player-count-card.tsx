'use client';

import { useEffect, useRef, useState } from 'react';
import type { AckResult } from '@campus-pubquiz/types';
import {
  DEFAULT_PLAYER_COUNT,
  PlayerCountStepper,
} from '@/app/play/player-count-stepper';

/** How long "Saved ✓" stays up before a saved card folds into its one-line form. */
const COLLAPSE_AFTER_SAVED_MS = 1500;

interface PlayerCountCardProps {
  /** The count the server holds for this team, or null until one is reported. */
  savedCount: number | null;
  onSend: (playerCount: number) => Promise<AckResult>;
  /** When given, an unanswered card offers a way to skip it. */
  onDismiss?: () => void;
}

function describePlayers(count: number): string {
  return `${count} ${count === 1 ? 'player' : 'players'}`;
}

/**
 * "How many players are you?": asks while the team has no count, and once one
 * is saved folds into "(n) players · edit", which reopens the card.
 */
export function PlayerCountCard({
  savedCount,
  onSend,
  onDismiss,
}: PlayerCountCardProps) {
  const [isEditing, setIsEditing] = useState(savedCount === null);
  // What this phone last had acknowledged, for the folded line while the
  // server's own count has not reached the page yet.
  const [sentCount, setSentCount] = useState<number | null>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = savedCount ?? sentCount;

  useEffect(
    () => () => {
      if (collapseTimerRef.current !== null) {
        clearTimeout(collapseTimerRef.current);
      }
    },
    [],
  );

  function handleSaved(playerCount: number): void {
    setSentCount(playerCount);
    if (collapseTimerRef.current !== null) {
      clearTimeout(collapseTimerRef.current);
    }
    collapseTimerRef.current = setTimeout(
      () => setIsEditing(false),
      COLLAPSE_AFTER_SAVED_MS,
    );
  }

  if (!isEditing && count !== null) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="w-full rounded-lg border border-foreground/15 px-4 py-2 text-center text-sm font-extrabold text-foreground/70"
      >
        {describePlayers(count)} · edit
      </button>
    );
  }

  return (
    <section
      aria-labelledby="player-count-heading"
      className="flex w-full flex-col items-center gap-3 rounded-lg border border-foreground/15 p-4"
    >
      <h2 id="player-count-heading" className="font-display text-lg">
        How many players are you?
      </h2>
      <PlayerCountStepper
        initialCount={count ?? DEFAULT_PLAYER_COUNT}
        onSend={onSend}
        onSaved={handleSaved}
      />
      {onDismiss && count === null && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-extrabold text-foreground/55 underline"
        >
          Dismiss
        </button>
      )}
    </section>
  );
}
