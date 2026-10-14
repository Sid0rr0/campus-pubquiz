export const VIBRATION_PATTERNS = {
  success: [120],
  lock: [200],
  turn: [80, 60, 80],
  rankUp: [60, 40, 60],
} as const;

export type VibrationName = keyof typeof VIBRATION_PATTERNS;

/**
 * The only caller of `navigator.vibrate`. Does nothing where it is
 * unsupported (iOS Safari); vibration is an extra, nothing depends on it.
 */
export function vibrate(name: VibrationName): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) {
    return;
  }
  navigator.vibrate([...VIBRATION_PATTERNS[name]]);
}
