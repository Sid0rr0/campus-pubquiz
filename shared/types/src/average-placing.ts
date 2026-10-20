/**
 * The unrounded mean of a list of placings, or null for none. The caller
 * decides which nights to pass in (the league: nights that count towards the
 * league; the team page: every night with a placing).
 */
export function averagePlacing(placings: readonly number[]): number | null {
  if (placings.length === 0) return null;
  return placings.reduce((sum, placing) => sum + placing, 0) / placings.length;
}

/** The average placing as screens show it, to one decimal. */
export function displayedAveragePlacing(
  placings: readonly number[],
): number | null {
  const average = averagePlacing(placings);
  return average === null ? null : Math.round(average * 10) / 10;
}
