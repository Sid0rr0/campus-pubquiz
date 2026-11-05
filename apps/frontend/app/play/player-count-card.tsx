'use client';

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { MotionConfig, motion } from 'motion/react';
import type { AckResult } from '@campus-pubquiz/types';
import {
  DEFAULT_PLAYER_COUNT,
  PlayerCountStepper,
} from '@/app/play/player-count-stepper';

/** How long "Saved ✓" stays up before a saved card slides down into its one-line form. */
const COLLAPSE_AFTER_SAVED_MS = 1500;

/** Shared by the asking card and its folded line, so one slides into the other. */
const CARD_LAYOUT_ID = 'player-count-card';

interface PlayerCountCardProps {
  /** The count the server holds for this team, or null until one is reported. */
  savedCount: number | null;
  onSend: (playerCount: number) => Promise<AckResult>;
  /** When given, an unanswered card offers a way to skip it. */
  onDismiss?: () => void;
  /** Where the answered card lives: the bottom of the page. */
  bottomSlot: HTMLElement | null;
}

function describePlayers(count: number): string {
  return `${count} ${count === 1 ? 'player' : 'players'}`;
}

/**
 * "How many players does your team have?": asks while the team has no count, and once one
 * is saved, here or elsewhere, slides to the bottom of the page and folds into
 * "(n) players · edit", which reopens the card there.
 */
export function PlayerCountCard({
  savedCount,
  onSend,
  onDismiss,
  bottomSlot,
}: PlayerCountCardProps) {
  // Why this phone keeps the card open whatever count arrives: its own send
  // from where the card asks (until "Saved ✓" has been seen), or a tapped edit.
  const [openReason, setOpenReason] = useState<'asking' | 'editing' | null>(
    null,
  );
  // What this phone last had acknowledged, for the folded line while the
  // server's own count has not reached the page yet.
  const [sentCount, setSentCount] = useState<number | null>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = savedCount ?? sentCount;
  const isFolded = openReason === null && count !== null;

  useClearTimeoutOnUnmount(collapseTimerRef);

  async function send(playerCount: number): Promise<AckResult> {
    setOpenReason((reason) => reason ?? 'asking');
    const result = await onSend(playerCount);
    if (!result.success) {
      setOpenReason((reason) => (reason === 'asking' ? null : reason));
    }
    return result;
  }

  function handleSaved(playerCount: number): void {
    setSentCount(playerCount);
    clearPending(collapseTimerRef);
    collapseTimerRef.current = setTimeout(
      () => setOpenReason(null),
      COLLAPSE_AFTER_SAVED_MS,
    );
  }

  const card = (
    <MotionConfig reducedMotion="user">
      {isFolded ? (
        <motion.button
          layoutId={CARD_LAYOUT_ID}
          layout="position"
          type="button"
          onClick={() => setOpenReason('editing')}
          className="w-full rounded-lg border border-foreground/15 px-4 py-2 text-center text-sm font-extrabold text-foreground/70"
        >
          {describePlayers(count)} · edit
        </motion.button>
      ) : (
        <OpenPlayerCountCard
          count={count}
          onSend={send}
          onSaved={handleSaved}
          onDismiss={onDismiss}
        />
      )}
    </MotionConfig>
  );

  if (!isFolded && openReason !== 'editing') return card;
  return portalInto(card, bottomSlot);
}

type TimerRef = RefObject<ReturnType<typeof setTimeout> | null>;

function clearPending(timerRef: TimerRef): void {
  if (timerRef.current !== null) clearTimeout(timerRef.current);
}

function useClearTimeoutOnUnmount(timerRef: TimerRef): void {
  useEffect(() => () => clearPending(timerRef), [timerRef]);
}

function OpenPlayerCountCard({
  count,
  onSend,
  onSaved,
  onDismiss,
}: {
  count: number | null;
  onSend: (playerCount: number) => Promise<AckResult>;
  onSaved: (playerCount: number) => void;
  onDismiss: PlayerCountCardProps['onDismiss'];
}) {
  return (
    <motion.section
      layoutId={CARD_LAYOUT_ID}
      layout="position"
      aria-labelledby="player-count-heading"
      className="flex w-full flex-col items-center gap-3 rounded-lg border border-foreground/15 p-4"
    >
      <h2 id="player-count-heading" className="font-display text-lg">
        How many players does your team have?
      </h2>
      <PlayerCountStepper
        initialCount={count ?? DEFAULT_PLAYER_COUNT}
        onSend={onSend}
        onSaved={onSaved}
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
    </motion.section>
  );
}

/** Folded or being edited, the card moves to the bottom slot (nothing until the slot exists). */
function portalInto(
  card: ReactNode,
  bottomSlot: HTMLElement | null | undefined,
) {
  return bottomSlot && createPortal(card, bottomSlot);
}
