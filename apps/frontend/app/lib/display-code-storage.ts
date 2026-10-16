export const DISPLAY_CODE_STORAGE_KEY = 'campus-pubquiz-display-code';

/** The game code this big screen last showed, or null (also when storage is unavailable). */
export function readStoredDisplayCode(): string | null {
  try {
    return window.localStorage.getItem(DISPLAY_CODE_STORAGE_KEY);
  } catch {
    // Private browsing or blocked storage: the big screen just starts at the picker.
    return null;
  }
}

export function storeDisplayCode(code: string): void {
  try {
    window.localStorage.setItem(DISPLAY_CODE_STORAGE_KEY, code);
  } catch {
    // Not remembering the code only costs a manual pick after a reload.
  }
}

export function clearStoredDisplayCode(): void {
  try {
    window.localStorage.removeItem(DISPLAY_CODE_STORAGE_KEY);
  } catch {
    // Nothing stored, nothing to forget.
  }
}
