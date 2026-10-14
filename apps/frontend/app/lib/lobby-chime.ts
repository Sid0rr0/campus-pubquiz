/** Minimum gap between two lobby chimes, however many teams join. */
export const LOBBY_CHIME_MIN_GAP_MS = 500;

export interface ChimeLimiter {
  /** True at most once per gap; the caller plays the chime when it is. */
  shouldChime: () => boolean;
}

export function createChimeLimiter(
  minGapMs: number,
  now: () => number = Date.now,
): ChimeLimiter {
  let lastChimeAt: number | null = null;
  return {
    shouldChime() {
      const currentMs = now();
      if (lastChimeAt !== null && currentMs - lastChimeAt < minGapMs) {
        return false;
      }
      lastChimeAt = currentMs;
      return true;
    },
  };
}

/**
 * Teams in `teams` that were not in the previous snapshot. The first snapshot
 * (`previousIds` null) has no new teams: it is a load, not a join.
 */
export function findNewTeamIds(
  previousIds: ReadonlySet<number> | null,
  teams: readonly { teamId: number }[],
): number[] {
  if (previousIds === null) {
    return [];
  }
  return teams
    .filter((team) => !previousIds.has(team.teamId))
    .map((team) => team.teamId);
}
