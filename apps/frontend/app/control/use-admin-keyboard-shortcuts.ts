import { useEffect } from 'react';
import { ADMIN_SHORTCUTS } from '@/app/control/admin-keyboard-shortcuts';
import type {
  AdvanceSlotStep,
  GameAction,
  PreviousState,
} from '@campus-pubquiz/types';

export interface UseAdminKeyboardShortcutsOptions {
  advanceStep: AdvanceSlotStep;
  previousState: PreviousState;
  isLeaderboardVisible: boolean;
  /** Whether the join overlay can be toggled now: after the lobby and before the quiz ends. */
  canToggleJoinOverlay: boolean;
  /** Whether the Pause/Resume button is shown: an open question with pausable media. */
  canPauseMedia: boolean;
  isDisplaySoundMuted: boolean;
  sendAction: (action: GameAction) => void;
  setDisplaySoundMuted: (isMuted: boolean) => void;
}

/** Letter keys match in either case (Shift, Caps Lock); named keys match exactly. */
function matchesKey(event: KeyboardEvent, shortcutKey: string): boolean {
  return shortcutKey.length === 1
    ? event.key.toLowerCase() === shortcutKey
    : event.key === shortcutKey;
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
 * allows it (the server resolves what a leaderboard press means); Up/Down show/hide the leaderboard; F toggles a fullscreen view of the
 * current question's media on /display; Space pauses/resumes it (only while
 * the Pause button is shown); M toggles the big-screen mute. Letter keys match
 * either case. Ignored while focus is in a form field so typing a password or
 * a grade isn't hijacked.
 */
export function useAdminKeyboardShortcuts({
  advanceStep,
  previousState,
  isLeaderboardVisible,
  canToggleJoinOverlay,
  canPauseMedia,
  isDisplaySoundMuted,
  sendAction,
  setDisplaySoundMuted,
}: UseAdminKeyboardShortcutsOptions): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (isEditableTarget(event.target)) {
        return;
      }
      if (event.key === ADMIN_SHORTCUTS.previous.key) {
        if (previousState === 'available') {
          event.preventDefault();
          sendAction('PREVIOUS');
        }
        return;
      }
      if (event.key === ADMIN_SHORTCUTS.advance.key) {
        if (advanceStep !== 'none') {
          event.preventDefault();
          sendAction('ADVANCE');
        }
        return;
      }
      if (event.key === ADMIN_SHORTCUTS.showLeaderboard.key) {
        if (!isLeaderboardVisible) {
          event.preventDefault();
          sendAction('TOGGLE_LEADERBOARD');
        }
        return;
      }
      if (
        event.key === ADMIN_SHORTCUTS.hideLeaderboard.key &&
        isLeaderboardVisible
      ) {
        event.preventDefault();
        sendAction('TOGGLE_LEADERBOARD');
        return;
      }
      if (matchesKey(event, ADMIN_SHORTCUTS.toggleJoinOverlay.key)) {
        if (canToggleJoinOverlay) {
          event.preventDefault();
          sendAction('TOGGLE_JOIN_OVERLAY');
        }
        return;
      }
      if (matchesKey(event, ADMIN_SHORTCUTS.toggleMediaFullscreen.key)) {
        event.preventDefault();
        sendAction('TOGGLE_MEDIA_FULLSCREEN');
        return;
      }
      if (matchesKey(event, ADMIN_SHORTCUTS.toggleMediaPause.key)) {
        if (canPauseMedia) {
          event.preventDefault();
          sendAction('TOGGLE_MEDIA_PAUSE');
        }
        return;
      }
      if (matchesKey(event, ADMIN_SHORTCUTS.toggleDisplayMute.key)) {
        event.preventDefault();
        setDisplaySoundMuted(!isDisplaySoundMuted);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    advanceStep,
    previousState,
    isLeaderboardVisible,
    canToggleJoinOverlay,
    canPauseMedia,
    isDisplaySoundMuted,
    sendAction,
    setDisplaySoundMuted,
  ]);
}
