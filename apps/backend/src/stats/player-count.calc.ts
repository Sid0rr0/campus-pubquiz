import type { SessionDetailPlayerCount } from '@campus-pubquiz/types';

/**
 * Adds up the counts of the teams that gave one. `participantCounts` holds one
 * entry per participant, null for a team with no count, so a skipped team is
 * left out of the total and the average instead of counting as zero.
 */
export function summarisePlayerCounts(
  participantCounts: readonly (number | null)[],
): SessionDetailPlayerCount {
  const known = participantCounts.filter(
    (count): count is number => count !== null,
  );
  const total = known.reduce((sum, count) => sum + count, 0);
  return {
    total,
    average: known.length > 0 ? total / known.length : null,
    reportedTeams: known.length,
  };
}
