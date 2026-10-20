import { compareTeamNames, type LeagueTableRow } from '@campus-pubquiz/types';

/** Points for placing 1st to 5th in a session; nothing below 5th. */
export const LEAGUE_PLACING_POINTS = [5, 4, 3, 2, 1] as const;
/** Points for having answered at least one question in a session. */
export const PARTICIPATION_POINTS = 1;

/**
 * One team's night in a league session. `placing` and `won` come straight
 * from the session's Standings (`rank` of the team's leaderboard entry, and
 * whether it is the single `winner`); this module never recomputes them.
 */
export interface TeamNight {
  teamId: number;
  teamName: string;
  /** Standings placing (shared among tied teams); null for a team that left. */
  placing: number | null;
  won: boolean;
  /** Whether the team answered at least one question in the session. */
  answered: boolean;
}

/** League points one night gives a team: placing points plus participation, or nothing when it never answered. */
export function leaguePointsFor({
  placing,
  answered,
}: Pick<TeamNight, 'placing' | 'answered'>): number {
  if (!answered) return 0;
  const placingPoints =
    placing === null ? 0 : (LEAGUE_PLACING_POINTS[placing - 1] ?? 0);
  return placingPoints + PARTICIPATION_POINTS;
}

interface Tally {
  teamId: number;
  teamName: string;
  leaguePoints: number;
  nightsPlayed: number;
  nightsWon: number;
  placings: number[];
}

function averageOf(placings: readonly number[]): number | null {
  if (placings.length === 0) return null;
  const mean = placings.reduce((sum, p) => sum + p, 0) / placings.length;
  return Math.round(mean * 10) / 10;
}

/** Lower is better; a team with no placing sorts after any team with one. */
function compareAverages(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/**
 * The league table from every team's nights across the league's sessions
 * (one entry per team per session). Ranked by league points, then more nights
 * won, then better average placing; teams level on all three share the
 * position (competition ranking: 1, 1, 3) and list by name.
 */
export function buildLeagueTable(
  nights: readonly TeamNight[],
): LeagueTableRow[] {
  const tallies = new Map<number, Tally>();
  for (const night of nights) {
    if (!night.answered) continue;
    const tally = tallies.get(night.teamId) ?? {
      teamId: night.teamId,
      teamName: night.teamName,
      leaguePoints: 0,
      nightsPlayed: 0,
      nightsWon: 0,
      placings: [],
    };
    tally.leaguePoints += leaguePointsFor(night);
    tally.nightsPlayed += 1;
    if (night.won) tally.nightsWon += 1;
    if (night.placing !== null) tally.placings.push(night.placing);
    tallies.set(night.teamId, tally);
  }

  const ordered = [...tallies.values()]
    .map((tally) => ({
      teamId: tally.teamId,
      teamName: tally.teamName,
      leaguePoints: tally.leaguePoints,
      nightsPlayed: tally.nightsPlayed,
      nightsWon: tally.nightsWon,
      averagePlacing: averageOf(tally.placings),
    }))
    .sort(
      (a, b) =>
        b.leaguePoints - a.leaguePoints ||
        b.nightsWon - a.nightsWon ||
        compareAverages(a.averagePlacing, b.averagePlacing) ||
        compareTeamNames(a.teamName, b.teamName) ||
        a.teamId - b.teamId,
    );

  const level = (a: (typeof ordered)[number], b: (typeof ordered)[number]) =>
    a.leaguePoints === b.leaguePoints &&
    a.nightsWon === b.nightsWon &&
    a.averagePlacing === b.averagePlacing;

  return ordered.map((row, index) => {
    let groupStart = index;
    while (groupStart > 0 && level(ordered[groupStart - 1], row)) groupStart--;
    return { ...row, position: groupStart + 1 };
  });
}
