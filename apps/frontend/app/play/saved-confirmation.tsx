'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AckResult } from '@campus-pubquiz/types';

const SAVED_VISIBLE_MS = 1500;
const NOT_JOINED_RESULT: AckResult = {
  success: false,
  error: 'Not connected to a game',
};

type SubmitAnswer = (
  questionId: number,
  teamId: number,
  value: string,
) => Promise<AckResult>;

/**
 * Wraps the phone's submit so every accepted one raises a short "Saved ✓".
 * It answers the team's own action, so it is not a live-change effect; a
 * refused submit shows nothing (the caller already surfaces the refusal).
 */
export function useSavedConfirmation(submitAnswer: SubmitAnswer | undefined): {
  isSaved: boolean;
  submitAndConfirm: SubmitAnswer;
} {
  const [isSaved, setIsSaved] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  const submitAndConfirm = useCallback<SubmitAnswer>(
    async (questionId, teamId, value) => {
      if (!submitAnswer) return NOT_JOINED_RESULT;
      const result = await submitAnswer(questionId, teamId, value);
      if (result?.success) {
        setIsSaved(true);
        if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(
          () => setIsSaved(false),
          SAVED_VISIBLE_MS,
        );
      }
      return result;
    },
    [submitAnswer],
  );

  return { isSaved, submitAndConfirm };
}

export function SavedConfirmation({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null;
  return (
    <p
      role="status"
      className="pointer-events-none fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full bg-green px-4 py-2 text-sm font-extrabold text-white shadow-lg md:bottom-6"
    >
      Saved ✓
    </p>
  );
}
