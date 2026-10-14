'use client';

import { useEffect, useRef } from 'react';

export interface LiveChangeGate {
  /**
   * Feed the latest snapshot's position (any number that only grows as the
   * quiz moves forward). True only for a forward move seen after a previous
   * snapshot: never the first one, never a repeat, never a Previous move.
   */
  observe: (position: number) => boolean;
  /** Forget the last snapshot; the next one counts as a fresh load. */
  reset: () => void;
}

export function createLiveChangeGate(): LiveChangeGate {
  let last: number | null = null;
  return {
    observe(position) {
      const isForward = last !== null && position > last;
      last = position;
      return isForward;
    },
    reset() {
      last = null;
    },
  };
}

/**
 * The one rule for one-off effects (sound, vibration, confetti, stamps):
 * `onLiveMove` runs only when a connected client sees the game move forward.
 * Never on the first snapshot after load or reconnect, never on Previous.
 */
export function useOnLiveForwardMove(
  position: number,
  isConnected: boolean,
  onLiveMove: () => void,
): void {
  const gateRef = useRef<LiveChangeGate | null>(null);
  const callbackRef = useRef(onLiveMove);
  useEffect(() => {
    callbackRef.current = onLiveMove;
  });

  useEffect(() => {
    gateRef.current ??= createLiveChangeGate();
    const gate = gateRef.current;
    if (!isConnected) {
      gate.reset();
      return;
    }
    if (gate.observe(position)) {
      callbackRef.current();
    }
  }, [position, isConnected]);
}
