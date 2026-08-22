import { useEffect } from 'react';
import type { GameAction } from '@campus-pubquiz/types';

export interface UseAdminKeyboardShortcutsOptions {
  canAdvance: boolean;
  canGoToPreviousQuestion: boolean;
  hasUnrevealedTeams: boolean;
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
 * Left/Right step through Previous/Advance (reveal leaderboard teams one at a
 * time once the board is up, then hide it again once every team's shown);
 * Up/Down show/hide the leaderboard. Ignored while focus is in a form field
 * so typing a password or a grade isn't hijacked.
 */
export function useAdminKeyboardShortcuts({
  canAdvance,
  canGoToPreviousQuestion,
  hasUnrevealedTeams,
  isLeaderboardVisible,
  sendAction,
}: UseAdminKeyboardShortcutsOptions): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (isEditableTarget(event.target)) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        if (canGoToPreviousQuestion && !isLeaderboardVisible) {
          event.preventDefault();
          sendAction('PREVIOUS');
        }
        return;
      }
      if (event.key === 'ArrowRight') {
        if (hasUnrevealedTeams) {
          event.preventDefault();
          sendAction('REVEAL_NEXT_TEAM');
        } else if (isLeaderboardVisible) {
          if (canAdvance) {
            event.preventDefault();
            sendAction('TOGGLE_LEADERBOARD');
          }
        } else if (canAdvance) {
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
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    canAdvance,
    canGoToPreviousQuestion,
    hasUnrevealedTeams,
    isLeaderboardVisible,
    sendAction,
  ]);
}
