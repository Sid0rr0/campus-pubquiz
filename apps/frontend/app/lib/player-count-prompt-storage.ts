const DISMISSED_KEY_PREFIX = 'campus-pubquiz-player-count-dismissed-';

function dismissedKey(joinCode: string): string {
  return `${DISMISSED_KEY_PREFIX}${joinCode}`;
}

/** Whether this phone's team dismissed the late player count card for this session. Storage may be blocked (private browsing), in which case nothing is remembered. */
export function readPlayerCountPromptDismissed(joinCode: string): boolean {
  try {
    return window.localStorage.getItem(dismissedKey(joinCode)) === '1';
  } catch {
    return false;
  }
}

/** Remembers on this phone that the late player count card was dismissed for this session. */
export function writePlayerCountPromptDismissed(joinCode: string): void {
  try {
    window.localStorage.setItem(dismissedKey(joinCode), '1');
  } catch {
    // Without storage the card is hidden for this page load only.
  }
}
