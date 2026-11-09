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
  /** Whether the Pause/Play button is shown: an open question with pausable media. */
  canPauseMedia: boolean;
  isDisplaySoundMuted: boolean;
  sendAction: (action: GameAction) => void;
  setDisplaySoundMuted: (isMuted: boolean) => void;
}

/** Letter keys match in either case (Shift, Caps Lock); named keys match exactly. */
function matchesKey(event: KeyboardEvent, shortcutKey: string): boolean {
  // Stryker disable next-line ConditionalExpression: dead code — every shortcut routed through matchesKey is a single character today (see ADMIN_SHORTCUTS), so the named-key branch below is never reached
  return shortcutKey.length === 1
    ? event.key.toLowerCase() === shortcutKey
    : // Stryker disable next-line ConditionalExpression,EqualityOperator: dead code, see above
      event.key === shortcutKey;
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

/** Browser/OS chords (Cmd+F, Ctrl+J, Alt+Left…) are not ours, and typing in a form field mustn't be hijacked; Shift stays allowed so uppercase letters still match. A held key repeats, and each repeat would press Advance again, so only the first press counts. */
function isShortcutCandidate(event: KeyboardEvent): boolean {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  return !isEditableTarget(event.target);
}

export interface UseAdminMediaPauseShortcutOptions {
  /** Whether the Pause/Play button is shown. */
  canPauseMedia: boolean;
  sendAction: (action: GameAction) => void;
}

/**
 * /remote's only shortcut: Space pauses/plays the media, under the same
 * rules as on /control (only while the Pause/Play button is shown, ignored
 * in form fields and chords, left to the browser otherwise).
 */
export function useAdminMediaPauseShortcut({
  canPauseMedia,
  sendAction,
}: UseAdminMediaPauseShortcutOptions): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (!isShortcutCandidate(event)) {
        return;
      }
      if (
        matchesKey(event, ADMIN_SHORTCUTS.toggleMediaPause.key) &&
        canPauseMedia
      ) {
        event.preventDefault();
        sendAction('TOGGLE_MEDIA_PAUSE');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canPauseMedia, sendAction]);
}

/**
 * Left/Right send PREVIOUS/ADVANCE whenever the server's announced step
 * allows it (the server resolves what a leaderboard press means); Up/Down show/hide the leaderboard; F toggles a fullscreen view of the
 * current question's media on /display; Space pauses/plays it (only while
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
    const options = {
      advanceStep,
      previousState,
      isLeaderboardVisible,
      canToggleJoinOverlay,
      canPauseMedia,
      isDisplaySoundMuted,
      sendAction,
      setDisplaySoundMuted,
    };
    function handleKeyDown(event: KeyboardEvent): void {
      if (!isShortcutCandidate(event)) return;
      const rule = SHORTCUT_RULES.find((candidate) =>
        candidate.matches(event, options),
      );
      if (!rule?.isEnabled(options)) return;
      event.preventDefault();
      rule.run(options);
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

type ShortcutOptions = UseAdminKeyboardShortcutsOptions;

/**
 * The shortcuts in the order they are tried. The first rule whose key matches
 * claims the key press, and acts only when it is enabled. Hiding the
 * leaderboard only claims its key while the board is up.
 */
const SHORTCUT_RULES: {
  matches: (event: KeyboardEvent, options: ShortcutOptions) => boolean;
  isEnabled: (options: ShortcutOptions) => boolean;
  run: (options: ShortcutOptions) => void;
}[] = [
  {
    matches: (event) => event.key === ADMIN_SHORTCUTS.previous.key,
    isEnabled: (options) => options.previousState === 'available',
    run: (options) => options.sendAction('PREVIOUS'),
  },
  {
    matches: (event) => event.key === ADMIN_SHORTCUTS.advance.key,
    isEnabled: (options) => options.advanceStep !== 'none',
    run: (options) => options.sendAction('ADVANCE'),
  },
  {
    matches: (event) => event.key === ADMIN_SHORTCUTS.showLeaderboard.key,
    isEnabled: (options) => !options.isLeaderboardVisible,
    run: (options) => options.sendAction('TOGGLE_LEADERBOARD'),
  },
  {
    matches: (event, options) =>
      event.key === ADMIN_SHORTCUTS.hideLeaderboard.key &&
      options.isLeaderboardVisible,
    isEnabled: () => true,
    run: (options) => options.sendAction('TOGGLE_LEADERBOARD'),
  },
  {
    matches: (event) =>
      matchesKey(event, ADMIN_SHORTCUTS.toggleJoinOverlay.key),
    isEnabled: (options) => options.canToggleJoinOverlay,
    run: (options) => options.sendAction('TOGGLE_JOIN_OVERLAY'),
  },
  {
    matches: (event) =>
      matchesKey(event, ADMIN_SHORTCUTS.toggleMediaFullscreen.key),
    isEnabled: () => true,
    run: (options) => options.sendAction('TOGGLE_MEDIA_FULLSCREEN'),
  },
  {
    matches: (event) => matchesKey(event, ADMIN_SHORTCUTS.toggleMediaPause.key),
    isEnabled: (options) => options.canPauseMedia,
    run: (options) => options.sendAction('TOGGLE_MEDIA_PAUSE'),
  },
  {
    matches: (event) =>
      matchesKey(event, ADMIN_SHORTCUTS.toggleDisplayMute.key),
    isEnabled: () => true,
    run: (options) =>
      options.setDisplaySoundMuted(!options.isDisplaySoundMuted),
  },
];
