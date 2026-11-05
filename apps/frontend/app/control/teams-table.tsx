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
/** A standings row with the team's coins beside it (set only in a session with power-ups). */
type TeamRow = LeaderboardEntry & { coins: number | undefined };
const helper = createColumnHelper<typeof features, TeamRow>();

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
  const [viewingAwardsTeamId, setViewingAwardsTeamId] = useState<number | null>(
    null,
  );
  const [viewingCodeTeamId, setViewingCodeTeamId] = useState<number | null>(
    null,
  );
  const roundCount = roundTitles.length;
  const hasCoins = coinsByTeamId !== undefined;
  // The column definitions must keep their identity across server updates: a new
  // definition makes every cell a new component, which closes an open actions menu.
  // Titles and coins arrive fresh in every snapshot, so only their shape counts here.
  const rows = leaderboard.map(
    (entry): TeamRow => ({ ...entry, coins: coinsByTeamId?.[entry.teamId] }),
  );
  const columns = useMemo(
    () =>
      teamColumns(roundCount, hasCoins, {
        award: setAwardingTeamId,
        viewAwards: setViewingAwardsTeamId,
        viewCode: setViewingCodeTeamId,
      }),
    [roundCount, hasCoins],
  );
  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (entry) => String(entry.teamId),
  });
  const teamNameOf = (teamId: number | null) =>
    leaderboard.find((entry) => entry.teamId === teamId)?.teamName ?? '';
  const closeWith =
    (clear: (teamId: null) => void) =>
    (open: boolean): void => {
      if (!open) clear(null);
    };

  return (
    <>
      <SortableTable
        table={table}
        tone="dark-blue"
        emptyMessage="No teams have joined yet."
      />
      <AwardBonusDialog
        awardingTeam={
          leaderboard.find((entry) => entry.teamId === awardingTeamId) ?? null
        }
        enabledBonusCategories={enabledBonusCategories}
        isCoinsEnabled={hasCoins}
        onAwardBonus={onAwardBonus}
        onClose={() => setAwardingTeamId(null)}
      />
      <BonusAwardsListModal
        joinCode={joinCode}
        teamId={viewingAwardsTeamId}
        teamName={teamNameOf(viewingAwardsTeamId)}
        onOpenChange={closeWith(setViewingAwardsTeamId)}
      />
      <TeamCodeModal
        teamId={viewingCodeTeamId}
        teamName={teamNameOf(viewingCodeTeamId)}
        joinCode={joinCode}
        onOpenChange={closeWith(setViewingCodeTeamId)}
      />
    </>
  );
}

interface TeamActions {
  award: (teamId: number) => void;
  viewAwards: (teamId: number) => void;
  viewCode: (teamId: number) => void;
}

function teamColumns(
  roundCount: number,
  hasCoins: boolean,
  actions: TeamActions,
) {
  return helper.columns([
    helper.display({
      id: 'position',
      header: 'Position',
      cell: (context) => formatRankLabel(context.row.original),
    }),
    helper.accessor('teamName', { header: 'Team', enableSorting: false }),
    ...Array.from({ length: roundCount }, (_, index) =>
      helper.accessor((entry) => pointsForRound(entry, index), {
        id: `round-${index}`,
        header: `${index + 1}`,
        sortFn: sortFn_basic,
        cell: (context) => (
          <span className="inline-flex items-center gap-1">
            {context.getValue()}
            {context.row.original.roundPoints[index]?.isJoker && <JokerMark />}
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
    ...(hasCoins
      ? [
          helper.display({
            id: 'coins',
            header: 'Coins',
            cell: (context) => context.row.original.coins,
          }),
        ]
      : []),
    helper.display({
      id: 'actions',
      header: 'Actions',
      cell: (context) => (
        <TeamActionsMenu entry={context.row.original} actions={actions} />
      ),
    }),
  ]);
}

function TeamActionsMenu({
  entry,
  actions,
}: {
  entry: TeamRow;
  actions: TeamActions;
}) {
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
            onSelect={() => actions.award(entry.teamId)}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-bold text-dark-blue outline-none data-highlighted:bg-dark-blue/10"
          >
            <StarIcon aria-hidden="true" />
            Award bonus
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => actions.viewAwards(entry.teamId)}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-bold text-dark-blue outline-none data-highlighted:bg-dark-blue/10"
          >
            <ListBulletIcon aria-hidden="true" />
            Bonus awards
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => actions.viewCode(entry.teamId)}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-bold text-dark-blue outline-none data-highlighted:bg-dark-blue/10"
          >
            <EyeOpenIcon aria-hidden="true" />
            Show team code
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function AwardBonusDialog({
  awardingTeam,
  enabledBonusCategories,
  isCoinsEnabled,
  onAwardBonus,
  onClose,
}: {
  awardingTeam: TeamsTableProps['leaderboard'][number] | null;
  enabledBonusCategories: TeamsTableProps['enabledBonusCategories'];
  isCoinsEnabled: boolean;
  onAwardBonus: TeamsTableProps['onAwardBonus'];
  onClose: () => void;
}) {
  // Drops a second submit while the first award awaits its acknowledgement.
  const isAwardInFlightRef = useRef(false);
  return (
    <Dialog.Root
      open={awardingTeam !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
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
              isCoinsEnabled={isCoinsEnabled}
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
                    onClose();
                  }
                } finally {
                  isAwardInFlightRef.current = false;
                }
              }}
              onCancel={onClose}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
