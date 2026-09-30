/** The minimum a team needs for the ranking rule: who it is and its total (quiz points + bonus points). */
export interface RankableTeam {
  teamId: number;
  teamName: string;
  totalPoints: number;
}

export type RankedTeam<T extends RankableTeam> = T & {
  /** 1-based competition rank: the first place of this team's tie group. */
  rank: number;
  /** The last place the tie group spans — equal to `rank` when not tied. */
  rankTo: number;
};

/**
 * Name order for ties. Plain UTF-16 code-unit comparison on purpose:
 * unlike `localeCompare` or a database collation it gives the same answer
 * in every runtime, so every screen orders the same names the same way.
 */
export function compareTeamNames(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * The one ranking rule: total descending, then team name, then team id
 * (so identical names still order deterministically). Teams with equal
 * totals share a competition rank — the rank of the group's first place —
 * and the next group's rank skips past the whole tie (1, 2, 2, 2, 5).
 */
export function rankTeams<T extends RankableTeam>(
  teams: readonly T[],
): RankedTeam<T>[] {
  const ordered = [...teams].sort(
    (a, b) =>
      b.totalPoints - a.totalPoints ||
      compareTeamNames(a.teamName, b.teamName) ||
      a.teamId - b.teamId,
  );

  const ranked: RankedTeam<T>[] = [];
  let groupStart = 0;
  for (let i = 0; i < ordered.length; i++) {
    const isGroupEnd =
      i === ordered.length - 1 ||
      ordered[i + 1].totalPoints !== ordered[i].totalPoints;
    if (!isGroupEnd) continue;
    for (let j = groupStart; j <= i; j++) {
      ranked.push({ ...ordered[j], rank: groupStart + 1, rankTo: i + 1 });
    }
    groupStart = i + 1;
  }
  return ranked;
}

/**
 * The single winner: the first team in ranking order, or undefined when
 * there are no teams. An unbroken tie for first falls back to name order.
 */
export function getWinner<T extends RankableTeam>(
  teams: readonly T[],
): RankedTeam<T> | undefined {
  return rankTeams(teams)[0];
}
