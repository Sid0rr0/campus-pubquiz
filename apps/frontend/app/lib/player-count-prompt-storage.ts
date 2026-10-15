const DISMISSED_KEY_PREFIX = 'campus-pubquiz-player-count-dismissed-';
const DECIDED_KEY_PREFIX = 'campus-pubquiz-player-count-asked-';

function dismissedKey(joinCode: string): string {
  return `${DISMISSED_KEY_PREFIX}${joinCode}`;
}

function decidedKey(joinCode: string): string {
  return `${DECIDED_KEY_PREFIX}${joinCode}`;
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

/** Whether this phone already decided to ask (true) or not to ask (false) for this session, or null when it has not decided yet or storage is blocked. */
export function readPlayerCountPromptDecision(
  joinCode: string,
): boolean | null {
  try {
    const stored = window.localStorage.getItem(decidedKey(joinCode));
    return stored === null ? null : stored === '1';
  } catch {
    return null;
  }
}

/** Remembers on this phone whether the late player count card is to be asked for this session, so a reload doesn't decide again. */
export function writePlayerCountPromptDecision(
  joinCode: string,
  shouldAsk: boolean,
): void {
  try {
    window.localStorage.setItem(decidedKey(joinCode), shouldAsk ? '1' : '0');
  } catch {
    // Without storage the decision is remade on a reload.
  }
}
