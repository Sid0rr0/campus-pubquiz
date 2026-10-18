export type AdminShortcutId =
  | 'previous'
  | 'advance'
  | 'showLeaderboard'
  | 'hideLeaderboard'
  | 'toggleJoinOverlay'
  | 'toggleMedia';

export interface AdminShortcut {
  /** The `KeyboardEvent.key` value that triggers it. */
  key: string;
  /** How the `/guide` page names the key. */
  keyName: string;
  /** What it does, for the `/guide` page. */
  description: string;
}

/** The one definition of the admin keyboard shortcuts: the hook listens for these keys and `/guide` lists them. */
export const ADMIN_SHORTCUTS: Readonly<Record<AdminShortcutId, AdminShortcut>> =
  {
    advance: {
      key: 'ArrowRight',
      keyName: 'Right arrow',
      description:
        'Advance to the next step of the quiz. While the leaderboard is showing, reveal the next team on it, then hide it once every team is revealed.',
    },
    previous: {
      key: 'ArrowLeft',
      keyName: 'Left arrow',
      description:
        'Go back one step, when Previous is available and the leaderboard is not showing.',
    },
    showLeaderboard: {
      key: 'ArrowUp',
      keyName: 'Up arrow',
      description: 'Show the leaderboard.',
    },
    hideLeaderboard: {
      key: 'ArrowDown',
      keyName: 'Down arrow',
      description: 'Hide the leaderboard.',
    },
    toggleJoinOverlay: {
      key: 'j',
      keyName: 'J',
      description:
        'Show or hide the join code and QR code over the big screen, once the quiz has started and until it ends.',
    },
    toggleMedia: {
      key: ' ',
      keyName: 'Space',
      description:
        "Toggle a fullscreen view of the current question's image or video on the big screen.",
    },
  };
