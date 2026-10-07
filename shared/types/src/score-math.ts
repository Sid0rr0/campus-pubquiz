/** Exactly half of `points`, unrounded — the Half grade and match all_or_nothing's one-wrong-pair credit. */
export function halfPoints(points: number): number {
  return points / 2;
}

/** `points` rounded to the nearest multiple of 0.5 — every automatic score is a whole or half point, so sums stay exact. */
export function nearestHalfPoint(points: number): number {
  return Math.round(points * 2) / 2;
}
