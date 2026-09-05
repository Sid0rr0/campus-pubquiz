import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { Dialog, DropdownMenu } from 'radix-ui';
import {
  DotsVerticalIcon,
  ListBulletIcon,
  StarIcon,
} from '@radix-ui/react-icons';
import type {
  BonusCategory,
  LeaderboardEntry,
  TeamView,
} from '@campus-pubquiz/types';
import { BonusAwardForm } from '@/app/control/bonus-award-form';
import { BonusAwardsListModal } from '@/app/control/bonus-awards-list-modal';
import { Button } from '@/app/components/button';

interface TeamsTableProps {
  joinCode: string;
  /** Every team that has joined the session — always present, even before any points are recorded. */
  teams: TeamView[];
  /** Points data, populated once grading/bonuses/leaderboard-toggle have run for at least one team. */
  leaderboard: LeaderboardEntry[];
  /** Round titles for the active quiz, in round order — drives one column per round. */
  roundTitles: string[];
  onAwardBonus: (
    teamId: number,
    category: BonusCategory,
    points: number,
    reason?: string,
  ) => void;
  enabledBonusCategories: BonusCategory[];
}

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, LeaderboardEntry>();

function pointsForRound(entry: LeaderboardEntry, roundTitle: string): number {
  return (
    entry.roundPoints.find((round) => round.roundTitle === roundTitle)
      ?.points ?? 0
  );
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
  const leaderboardByTeamId = new Map(
    leaderboard.map((entry) => [entry.teamId, entry]),
  );
  return teams
    .map(
      (team) =>
        leaderboardByTeamId.get(team.teamId) ?? zeroEntry(team, roundTitles),
    )
    .sort(
      (a, b) =>
        b.totalPoints - a.totalPoints || a.teamName.localeCompare(b.teamName),
    );
}

export function TeamsTable({
  joinCode,
  teams,
  leaderboard,
  roundTitles,
  onAwardBonus,
  enabledBonusCategories,
}: TeamsTableProps) {
  const [awardingTeamId, setAwardingTeamId] = useState<number | null>(null);
  const [viewingAwardsTeamId, setViewingAwardsTeamId] = useState<number | null>(
    null,
  );
  const entries = useMemo(
    () => buildEntries(teams, leaderboard, roundTitles),
    [teams, leaderboard, roundTitles],
  );
  const awardingTeam =
    entries.find((entry) => entry.teamId === awardingTeamId) ?? null;
  const viewingAwardsTeam =
    entries.find((entry) => entry.teamId === viewingAwardsTeamId) ?? null;
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
        helper.display({
          id: 'actions',
          header: 'Actions',
          cell: (context) => {
            const entry = context.row.original;
            return (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button
                    type="button"
                    size="icon-md"
                    aria-label={`Actions for ${entry.teamName}`}
                    className="rounded-lg border-2 border-dark-blue/15 text-dark-blue/70"
                  >
                    <DotsVerticalIcon aria-hidden="true" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    className="z-40 flex min-w-40 flex-col gap-0.5 rounded-lg border-2 border-dark-blue/15 bg-white p-1 shadow-lg"
                  >
                    <DropdownMenu.Item
                      onSelect={() => setAwardingTeamId(entry.teamId)}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-bold text-dark-blue outline-none data-highlighted:bg-dark-blue/10"
                    >
                      <StarIcon aria-hidden="true" />
                      Award bonus
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => setViewingAwardsTeamId(entry.teamId)}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-bold text-dark-blue outline-none data-highlighted:bg-dark-blue/10"
                    >
                      <ListBulletIcon aria-hidden="true" />
                      Bonus awards
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            );
          },
        }),
      ]),
    [roundTitles],
  );
  const table = useTable({
    features,
    columns,
    data: entries,
    getRowId: (entry) => String(entry.teamId),
  });

  return (
    <div className="overflow-x-auto rounded-xl border-2 border-dark-blue/15">
      <table className="w-full border-collapse text-left">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="border-b-2 border-dark-blue/15 bg-dark-blue/5"
            >
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-2 font-display text-sm text-dark-blue/70"
                >
                  {header.isPlaceholder ? null : (
                    <table.FlexRender header={header} />
                  )}
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
              <tr
                key={row.id}
                className="border-b border-dark-blue/10 last:border-b-0"
              >
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
      <Dialog.Root
        open={awardingTeamId !== null}
        onOpenChange={(open) => {
          if (!open) setAwardingTeamId(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-30 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-40 flex w-full max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl bg-foreground p-5 text-background">
            <Dialog.Title className="font-display text-lg">
              Award bonus — {awardingTeam?.teamName}
            </Dialog.Title>
            {awardingTeam && (
              <BonusAwardForm
                enabledCategories={enabledBonusCategories}
                onAward={(category, points, reason) => {
                  onAwardBonus(awardingTeam.teamId, category, points, reason);
                  setAwardingTeamId(null);
                }}
                onCancel={() => setAwardingTeamId(null)}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <BonusAwardsListModal
        joinCode={joinCode}
        teamId={viewingAwardsTeamId}
        teamName={viewingAwardsTeam?.teamName ?? ''}
        onOpenChange={(open) => {
          if (!open) setViewingAwardsTeamId(null);
        }}
      />
    </div>
  );
}
