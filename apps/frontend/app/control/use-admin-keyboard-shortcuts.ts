import { useEffect } from 'react';
import type {
  AdvanceSlotStep,
  GameAction,
  PreviousState,
} from '@campus-pubquiz/types';

export interface UseAdminKeyboardShortcutsOptions {
  advanceStep: AdvanceSlotStep;
  previousState: PreviousState;
  isLeaderboardVisible: boolean;
  sendAction: (action: GameAction) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

/**
 * Left/Right send PREVIOUS/ADVANCE whenever the server's announced step
 * allows it (the server resolves what a leaderboard press means); Up/Down show/hide the leaderboard; Space toggles a fullscreen view of the
 * current question's media on /display. Ignored while focus is in a form
 * field so typing a password or a grade isn't hijacked.
 */
export function useAdminKeyboardShortcuts({
  advanceStep,
  previousState,
  isLeaderboardVisible,
  sendAction,
}: UseAdminKeyboardShortcutsOptions): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (isEditableTarget(event.target)) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        if (previousState === 'available') {
          event.preventDefault();
          sendAction('PREVIOUS');
        }
        return;
      }
      if (event.key === 'ArrowRight') {
        if (advanceStep !== 'none') {
          event.preventDefault();
          sendAction('ADVANCE');
        }
        return;
      }
      if (event.key === 'ArrowUp') {
        if (!isLeaderboardVisible) {
          event.preventDefault();
          sendAction('TOGGLE_LEADERBOARD');
        }
        return;
      }
      if (event.key === 'ArrowDown' && isLeaderboardVisible) {
        event.preventDefault();
        sendAction('TOGGLE_LEADERBOARD');
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        sendAction('TOGGLE_MEDIA_FULLSCREEN');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [advanceStep, previousState, isLeaderboardVisible, sendAction]);
}
