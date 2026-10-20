/**
 * The display name rule: a session's custom name if set, else its quiz's
 * title. For code that holds the two values in memory; the Ended-sessions read
 * applies the same rule in SQL for sorting ({@link DISPLAY_NAME_SQL}).
 */
export function sessionDisplayName(
  customName: string | null | undefined,
  quizTitle: string,
): string {
  return customName ?? quizTitle;
}

/** The SQL twin of {@link sessionDisplayName}, over the `gs` and `qz` aliases. */
export const DISPLAY_NAME_SQL = 'coalesce(gs.name, qz.title)';
