/** Shared "Not recorded" fallback for any responseMs-derived stat — sessions
 * played before the responseMs column existed have none. */
export function formatResponseMs(ms: number | null): string {
  if (ms === null) return 'Not recorded';
  return `${(ms / 1000).toFixed(1)}s`;
}
