import { useMemo, useRef, useState } from 'react';
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { Dialog, DropdownMenu } from 'radix-ui';
import { toast } from 'sonner';
import {
  DotsVerticalIcon,
  EyeOpenIcon,
  ListBulletIcon,
  StarIcon,
} from '@radix-ui/react-icons';
import type {
  AckResult,
  BonusCategory,
  LeaderboardEntry,
} from '@campus-pubquiz/types';
import { BonusAwardForm } from '@/app/control/bonus-award-form';
import { BonusAwardsListModal } from '@/app/control/bonus-awards-list-modal';
import { TeamCodeModal } from '@/app/control/team-code-modal';
import { Button } from '@/app/components/button';
import { JokerMark } from '@/app/components/joker-mark';
import { SortableTable } from '@/app/components/sortable-table';
import { formatBonusAwardConfirmation } from '@/app/lib/bonus-categories';
import { formatRankLabel } from '@/app/lib/rank-label';

interface TeamsTableProps {
  joinCode: string;
  /** The session's standings exactly as the server ranked them — every joined team, already in order. */
  leaderboard: LeaderboardEntry[];
  /** Round titles for the active quiz, in round order — drives one column per round. */
  roundTitles: string[];
  onAwardBonus: (
    teamId: number,
    category: BonusCategory,
    points: number,
    reason?: string,
    coins?: number,
  ) => Promise<AckResult>;
  enabledBonusCategories: BonusCategory[];
  /** Each team's coins; the Coins column shows only when this is given (power-ups on). */
  coinsByTeamId?: Record<number, number>;
}

// Rows keep the server's ranking until a round column header is clicked.
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
const helper = createColumnHelper<typeof features, LeaderboardEntry>();

/** `roundPoints` arrives in round order, so a round's points sit at its index. A stale list may be shorter than the rounds. */
function pointsForRound(entry: LeaderboardEntry, roundIndex: number): number {
  return entry.roundPoints[roundIndex]?.points ?? 0;
}

export function TeamsTable({
  joinCode,
  leaderboard,
  roundTitles,
  onAwardBonus,
  enabledBonusCategories,
  coinsByTeamId,
}: TeamsTableProps) {
  const [awardingTeamId, setAwardingTeamId] = useState<number | null>(null);
  // Drops a second submit while the first award awaits its acknowledgement.
  const isAwardInFlightRef = useRef(false);
  const [viewingAwardsTeamId, setViewingAwardsTeamId] = useState<number | null>(
    null,
  );
  const [viewingCodeTeamId, setViewingCodeTeamId] = useState<number | null>(
    null,
  );
  const awardingTeam =
    leaderboard.find((entry) => entry.teamId === awardingTeamId) ?? null;
  const viewingAwardsTeam =
    leaderboard.find((entry) => entry.teamId === viewingAwardsTeamId) ?? null;
  const viewingCodeTeam =
    leaderboard.find((entry) => entry.teamId === viewingCodeTeamId) ?? null;
  const columns = useMemo(
    () =>
      helper.columns([
        helper.display({
          id: 'position',
          header: 'Position',
          cell: (context) => formatRankLabel(context.row.original),
        }),
        helper.accessor('teamName', { header: 'Team', enableSorting: false }),
        ...roundTitles.map((_title, index) =>
          helper.accessor((entry) => pointsForRound(entry, index), {
            id: `round-${index}`,
            header: `${index + 1}`,
            sortFn: sortFn_basic,
            cell: (context) => (
              <span className="inline-flex items-center gap-1">
                {context.getValue()}
                {context.row.original.roundPoints[index]?.isJoker && (
                  <JokerMark />
                )}
              </span>
            ),
          }),
        ),
        helper.accessor('bonusPoints', {
          header: 'Bonus',
          enableSorting: false,
        }),
        helper.accessor('totalPoints', {
          header: 'Total',
          enableSorting: false,
        }),
        ...(coinsByTeamId
          ? [
              helper.display({
                id: 'coins',
                header: 'Coins',
                cell: (context) => coinsByTeamId[context.row.original.teamId],
              }),
            ]
          : []),
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
                    <DropdownMenu.Item
                      onSelect={() => setViewingCodeTeamId(entry.teamId)}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-bold text-dark-blue outline-none data-highlighted:bg-dark-blue/10"
                    >
                      <EyeOpenIcon aria-hidden="true" />
                      Show team code
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            );
          },
        }),
      ]),
    [roundTitles, coinsByTeamId],
  );
  const table = useTable({
    features,
    columns,
    data: leaderboard,
    getRowId: (entry) => String(entry.teamId),
  });

  return (
    <>
      <SortableTable
        table={table}
        tone="dark-blue"
        emptyMessage="No teams have joined yet."
      />
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
                isCoinsEnabled={coinsByTeamId !== undefined}
                onAward={async (category, points, reason, coins) => {
                  if (isAwardInFlightRef.current) return;
                  isAwardInFlightRef.current = true;
                  try {
                    const result = await (coins === undefined
                      ? onAwardBonus(
                          awardingTeam.teamId,
                          category,
                          points,
                          reason,
                        )
                      : onAwardBonus(
                          awardingTeam.teamId,
                          category,
                          points,
                          reason,
                          coins,
                        ));
                    // A rejection keeps the dialog open with what was typed;
                    // its error toast comes from the admin hook.
                    if (result.success) {
                      toast.success(
                        formatBonusAwardConfirmation(
                          category,
                          points,
                          awardingTeam.teamName,
                          coins,
                        ),
                      );
                      setAwardingTeamId(null);
                    }
                  } finally {
                    isAwardInFlightRef.current = false;
                  }
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
      <TeamCodeModal
        teamId={viewingCodeTeamId}
        teamName={viewingCodeTeam?.teamName ?? ''}
        joinCode={joinCode}
        onOpenChange={(open) => {
          if (!open) setViewingCodeTeamId(null);
        }}
      />
    </>
  );
}
