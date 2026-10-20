/** A 0-1 rate as a whole percent ("62%"), or "—" when it says nothing (null).
 * `suffix` is appended only to a real figure, e.g. " correct". */
export function formatPercent(
  rate: number | null | undefined,
  suffix = '',
): string {
  if (rate == null) return '—';
  return `${(rate * 100).toFixed(0)}%${suffix}`;
}
