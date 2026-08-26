export const AUTO_ADVANCE_STORAGE_KEY = 'campus-pubquiz-auto-advance';

/** Missing key = enabled (default on) — matches today's always-follow behavior. */
export function readAutoAdvanceSetting(): boolean {
  return window.localStorage.getItem(AUTO_ADVANCE_STORAGE_KEY) !== '0';
}

export function writeAutoAdvanceSetting(enabled: boolean): void {
  window.localStorage.setItem(AUTO_ADVANCE_STORAGE_KEY, enabled ? '1' : '0');
}
