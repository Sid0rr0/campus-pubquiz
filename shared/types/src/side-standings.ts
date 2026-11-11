import type { LeaderboardEntry } from './room-views';
import type { SessionState } from './session-state';
import type { VersusSide } from './versus';

/** One Versus side's standing: its average leaderboard total and its share of the bar. */
export interface SideStanding {
  id: string;
  name: string;
  /** Position in the side list, which picks the side's colour (see `versusSideColor`). */
  colorIndex: number;
  teamCount: number;
  /** Average total of the counted teams as it is (may be negative); null when no team counts. */
  average: number | null;
  /** 0..1: the average floored at 0 over the sum of floored averages; equal for every side when that sum is 0. */
  share: number;
  isLeading: boolean;
}

export interface SideStandings {
  /** In side order. */
  sides: SideStanding[];
  /** More than one side leads. */
  isTied: boolean;
}

/** The session's current side standings, or undefined with Versus off (nothing is sent then). Computed from session state on every emit, so a pick or move shows without a scores change. */
export function describeSessionSideStandings(
  session: SessionState,
): SideStandings | undefined {
  return describeSessionBoardSides(session, session.leaderboard);
}

/** The side standings as they stood on the prior standings' board; undefined with Versus off or without prior standings. */
export function describePriorSideStandings(
  session: SessionState,
): SideStandings | undefined {
  return session.priorStandings
    ? describeSessionBoardSides(session, session.priorStandings.board)
    : undefined;
}

function describeSessionBoardSides(
  session: SessionState,
  entries: readonly LeaderboardEntry[],
): SideStandings | undefined {
  const { versusEnabled, versusSides } = session.seededGame.settings;
  if (!versusEnabled) return undefined;
  return describeSideStandings({
    entries,
    teamSides: session.teamSides,
    sides: versusSides,
    // Once the session has ended a roster team that never took part doesn't count.
    countedTeamIds:
      session.progress.status === 'ended'
        ? new Set(session.tookPartTeamIds)
        : undefined,
  });
}

/**
 * The Versus side standings from the full leaderboard entries (not the capped
 * board). A team counts when it is among `entries`, has a side in `teamSides`
 * and, if `countedTeamIds` is given, is in it. Pure: called for the current
 * entries and again for the prior standings' board.
 */
export function describeSideStandings({
  entries,
  teamSides,
  sides,
  countedTeamIds,
}: {
  entries: readonly LeaderboardEntry[];
  teamSides: Readonly<Record<number, string>>;
  sides: readonly VersusSide[];
  countedTeamIds?: ReadonlySet<number>;
}): SideStandings {
  const counted = entries.filter(
    (entry) => countedTeamIds === undefined || countedTeamIds.has(entry.teamId),
  );
  const averages = sides.map((side) => {
    const totals = counted
      .filter((entry) => teamSides[entry.teamId] === side.id)
      .map((entry) => entry.totalPoints);
    return {
      teamCount: totals.length,
      average:
        totals.length === 0
          ? null
          : totals.reduce((sum, total) => sum + total, 0) / totals.length,
    };
  });
  const floored = averages.map(({ average }) => Math.max(average ?? 0, 0));
  const flooredSum = floored.reduce((sum, value) => sum + value, 0);
  const best = Math.max(
    ...averages.flatMap(({ average }) => (average === null ? [] : [average])),
  );
  const standings = sides.map((side, index) => ({
    id: side.id,
    name: side.name,
    colorIndex: index,
    ...averages[index],
    share: flooredSum === 0 ? 1 / sides.length : floored[index] / flooredSum,
    isLeading:
      averages[index].average !== null && averages[index].average === best,
  }));
  return {
    sides: standings,
    isTied: standings.filter((side) => side.isLeading).length > 1,
  };
}
