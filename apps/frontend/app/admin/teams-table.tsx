import { useMemo } from 'react';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import type { LeaderboardEntry, TeamView } from '@campus-pubquiz/types';

interface TeamsTableProps {
  /** Every team that has joined the session — always present, even before any points are recorded. */
  teams: TeamView[];
  /** Points data, populated once grading/bonuses/leaderboard-toggle have run for at least one team. */
  leaderboard: LeaderboardEntry[];
  /** Round titles for the active quiz, in round order — drives one column per round. */
  roundTitles: string[];
}

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, LeaderboardEntry>();

function pointsForRound(entry: LeaderboardEntry, roundTitle: string): number {
  return entry.roundPoints.find((round) => round.roundTitle === roundTitle)?.points ?? 0;
}

function zeroEntry(team: TeamView, roundTitles: string[]): LeaderboardEntry {
  return {
    teamId: team.teamId,
    teamName: team.teamName,
    totalPoints: 0,
    bonusPoints: 0,
    roundPoints: roundTitles.map((roundTitle) => ({ roundTitle, points: 0 })),
  };
}

/** Every joined team, defaulting to zero points until the leaderboard has caught up. */
function buildEntries(
  teams: TeamView[],
  leaderboard: LeaderboardEntry[],
  roundTitles: string[],
): LeaderboardEntry[] {
  const leaderboardByTeamId = new Map(leaderboard.map((entry) => [entry.teamId, entry]));
  return teams
    .map((team) => leaderboardByTeamId.get(team.teamId) ?? zeroEntry(team, roundTitles))
    .sort((a, b) => b.totalPoints - a.totalPoints || a.teamName.localeCompare(b.teamName));
}

export function TeamsTable({ teams, leaderboard, roundTitles }: TeamsTableProps) {
  const entries = useMemo(
    () => buildEntries(teams, leaderboard, roundTitles),
    [teams, leaderboard, roundTitles],
  );
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('teamName', { header: 'Team' }),
        ...roundTitles.map((roundTitle, index) =>
          helper.accessor((entry) => pointsForRound(entry, roundTitle), {
            id: `round-${index}`,
            header: `${index + 1}`,
          }),
        ),
        helper.accessor('bonusPoints', { header: 'Bonus' }),
        helper.accessor('totalPoints', { header: 'Total' }),
      ]),
    [roundTitles],
  );
  const table = useTable({ features, columns, data: entries, getRowId: (entry) => String(entry.teamId) });

  return (
    <div className="overflow-x-auto rounded-xl border-2 border-dark-blue/15">
      <table className="w-full border-collapse text-left">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b-2 border-dark-blue/15 bg-dark-blue/5">
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-4 py-2 font-display text-sm text-dark-blue/70">
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-3 text-center text-dark-blue/50"
              >
                No teams have joined yet.
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-dark-blue/10 last:border-b-0">
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
