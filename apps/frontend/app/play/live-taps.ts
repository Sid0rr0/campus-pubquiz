/**
 * A team's own taps on a rating row, minus the settled ones (saved or failed)
 * whose row the server has since changed: once the server moves off the value
 * a tap was made against, the tap is dropped for good, so the server value
 * swinging back can't bring a stale tap back. A saving tap is always kept.
 * Returns `taps` itself when nothing was dropped.
 */
export function liveTaps<T extends { status: string; base: unknown }>(
  taps: Readonly<Record<string, T>>,
  serverValue: (key: string) => unknown,
): Readonly<Record<string, T>> {
  const kept = Object.entries(taps).filter(
    ([key, tap]) => tap.status === 'saving' || serverValue(key) === tap.base,
  );
  return kept.length === Object.keys(taps).length
    ? taps
    : Object.fromEntries(kept);
}
