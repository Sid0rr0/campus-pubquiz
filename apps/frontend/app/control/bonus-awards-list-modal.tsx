'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog } from 'radix-ui';
import { Pencil1Icon, TrashIcon } from '@radix-ui/react-icons';
import type { BonusAwardAdminView } from '@campus-pubquiz/types';
import {
  BonusAwardApiError,
  deleteBonusAward,
  fetchBonusAwards,
  updateBonusAward,
} from '@/app/lib/bonus-award-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { BONUS_CATEGORY_LABELS } from '@/app/lib/bonus-categories';
import { queryKeys } from '@/app/lib/query-keys';
import { Button } from '@/app/components/button';
import { formatCoins } from '@/app/play/power-ups-list';
import { ConfirmDialog } from '@/app/components/confirm-dialog';

interface AwardRowProps {
  award: BonusAwardAdminView;
  onSave: (points: number, reason?: string) => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}

/** One award, either showing its details or (while editing) an inline points/reason form — same validation as BonusAwardForm: non-zero finite points, non-empty reason only for category "custom". Category itself is read-only. */
function AwardRow({
  award,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: AwardRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  if (isEditing) {
    return (
      <AwardEditor
        award={award}
        isSaving={isSaving}
        onSave={(points, reason) => {
          onSave(points, reason);
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }
  return (
    <AwardSummary
      award={award}
      isDeleting={isDeleting}
      onEdit={() => setIsEditing(true)}
      onDelete={onDelete}
    />
  );
}

/** Edits a copy of the award's points (and a custom award's reason), started fresh from the award each time. */
function AwardEditor({
  award,
  isSaving,
  onSave,
  onCancel,
}: Pick<AwardRowProps, 'award' | 'isSaving' | 'onSave'> & {
  onCancel: () => void;
}) {
  const [pointsInput, setPointsInput] = useState(String(award.points));
  const [reasonInput, setReasonInput] = useState(award.reason ?? '');
  const label = BONUS_CATEGORY_LABELS[award.category];
  const isCustom = award.category === 'custom';
  const points = Number(pointsInput);
  const canSubmit = canSaveAward(points, isCustom ? reasonInput : null);

  function handleSave(): void {
    if (!canSubmit) return;
    onSave(points, isCustom ? reasonInput.trim() : undefined);
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-background/20 bg-background/5 p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold">{label}</span>
        <label className="flex items-center gap-2 font-bold">
          Points
          <input
            type="number"
            step={1}
            value={pointsInput}
            onChange={(event) => setPointsInput(event.target.value)}
            aria-label={`Points for ${label} award`}
            className="w-16 rounded border-2 border-background/30 bg-transparent px-2 py-1"
          />
        </label>
      </div>
      {isCustom && (
        <input
          type="text"
          value={reasonInput}
          onChange={(event) => setReasonInput(event.target.value)}
          placeholder="Reason"
          aria-label="Bonus reason"
          className="rounded border-2 border-background/30 bg-transparent px-2 py-1 text-background placeholder:text-background/40"
        />
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="solid-flat"
          disabled={!canSubmit || isSaving}
          onClick={handleSave}
          className="disabled:opacity-40"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isSaving}
          onClick={onCancel}
          className="font-bold text-background/70"
        >
          Cancel
        </Button>
      </div>
    </li>
  );
}

/** `customReason` is null for a predefined category, which needs no reason. */
function canSaveAward(points: number, customReason: string | null): boolean {
  return (
    Number.isFinite(points) &&
    points !== 0 &&
    (customReason === null || customReason.trim().length > 0)
  );
}

function AwardSummary({
  award,
  isDeleting,
  onEdit,
  onDelete,
}: Pick<AwardRowProps, 'award' | 'isDeleting' | 'onDelete'> & {
  onEdit: () => void;
}) {
  const label = BONUS_CATEGORY_LABELS[award.category];
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-background/20 bg-background/5 p-2.5 text-xs">
      <div className="flex flex-col gap-0.5">
        <span className="font-bold">
          {label} · {award.points > 0 ? '+' : ''}
          {award.points} pts
        </span>
        {award.reason && (
          <span className="text-background/70">{award.reason}</span>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          type="button"
          variant="icon"
          size="icon-sm"
          aria-label={`Edit ${label} award`}
          disabled={isDeleting}
          onClick={onEdit}
        >
          <Pencil1Icon aria-hidden="true" />
        </Button>
        <ConfirmDialog
          trigger={
            <Button
              type="button"
              variant="icon-danger"
              size="icon-sm"
              aria-label={`Delete ${label} award`}
              disabled={isDeleting}
            >
              <TrashIcon aria-hidden="true" />
            </Button>
          }
          title="Delete bonus award?"
          description="This removes the award and updates the leaderboard immediately."
          confirmLabel="Delete"
          onConfirm={onDelete}
        />
      </div>
    </li>
  );
}

interface BonusAwardsListModalProps {
  joinCode: string;
  /** null closes the dialog — same "one id, no team means closed" convention TeamsTable already uses for its award dialog. */
  teamId: number | null;
  teamName: string;
  onOpenChange: (open: boolean) => void;
}

/**
 * Lists every bonus award a team has received this session, with inline
 * edit (points + reason) and delete per row, then its coin awards (read-only:
 * to undo one, award the opposite coins). Leaderboard totals update on
 * their own once a mutation succeeds: the backend's notifyBonusAwardsChanged
 * pushes a fresh STATE_UPDATED snapshot down the same socket TeamsTable
 * already listens to, so only this modal's own award-list query needs
 * invalidating here.
 */
export function BonusAwardsListModal({
  joinCode,
  teamId,
  teamName,
  onOpenChange,
}: BonusAwardsListModalProps) {
  const isOpen = teamId !== null;
  const resolvedTeamId = teamId ?? -1;
  const awardsQuery = useQuery({
    queryKey: queryKeys.bonusAwards.forTeam(joinCode, resolvedTeamId),
    queryFn: () => fetchBonusAwards(joinCode, resolvedTeamId),
    enabled: isOpen,
  });
  const error = apiErrorMessage(
    awardsQuery.error,
    BonusAwardApiError,
    'Could not load bonus awards',
  );
  const { updateMutation, deleteMutation } = useAwardMutations(
    joinCode,
    resolvedTeamId,
  );

  const awards = awardsQuery.data?.awards ?? [];
  const coinAwards = awardsQuery.data?.coinAwards ?? [];

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-40 flex w-full max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl bg-foreground p-5 text-background">
          <Dialog.Title className="font-display text-lg">
            Bonus awards — {teamName}
          </Dialog.Title>
          <AwardsList
            awards={awards}
            error={error}
            mutations={{ updateMutation, deleteMutation }}
          />
          <CoinAwardsList coinAwards={coinAwards} />
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="self-end rounded-lg px-3 py-1.5 text-sm font-bold text-background/70"
          >
            Close
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AwardsList({
  awards,
  error,
  mutations: { updateMutation, deleteMutation },
}: {
  awards: AwardRowProps['award'][];
  error: string | null | undefined;
  mutations: ReturnType<typeof useAwardMutations>;
}) {
  if (awards.length === 0) {
    return error ? (
      <p role="alert" className="text-sm font-bold text-magenta">
        {error}
      </p>
    ) : (
      <p className="text-sm text-background/60">No bonus awards yet.</p>
    );
  }
  return (
    <>
      {error && (
        // A failed re-read keeps the list it last had.
        <p role="alert" className="text-sm font-bold text-magenta">
          {error}
        </p>
      )}
      <AwardRows
        awards={awards}
        mutations={{ updateMutation, deleteMutation }}
      />
    </>
  );
}

function AwardRows({
  awards,
  mutations: { updateMutation, deleteMutation },
}: {
  awards: AwardRowProps['award'][];
  mutations: ReturnType<typeof useAwardMutations>;
}) {
  return (
    <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
      {awards.map((award) => (
        <AwardRow
          key={award.id}
          award={award}
          isSaving={isPendingFor(
            updateMutation,
            updateMutation.variables?.awardId,
            award.id,
          )}
          isDeleting={isPendingFor(
            deleteMutation,
            deleteMutation.variables,
            award.id,
          )}
          onSave={(points, reason) =>
            updateMutation.mutate({ awardId: award.id, points, reason })
          }
          onDelete={() => deleteMutation.mutate(award.id)}
        />
      ))}
    </ul>
  );
}

function isPendingFor(
  mutation: { isPending: boolean },
  pendingAwardId: number | undefined,
  awardId: number,
): boolean {
  return mutation.isPending && pendingAwardId === awardId;
}

/** Edits and deletes a team's bonus awards, re-reading its list after each. */
function useAwardMutations(joinCode: string, teamId: number) {
  const queryClient = useQueryClient();
  function invalidate(): void {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.bonusAwards.forTeam(joinCode, teamId),
    });
  }
  const toastFailure = (fallback: string) => (mutationError: Error) =>
    toast.error(
      apiErrorMessage(mutationError, BonusAwardApiError, fallback) ?? fallback,
    );

  const updateMutation = useMutation({
    mutationFn: ({
      awardId,
      points,
      reason,
    }: {
      awardId: number;
      points: number;
      reason?: string;
    }) => updateBonusAward(joinCode, awardId, points, reason),
    onSuccess: invalidate,
    onError: toastFailure('Could not update bonus award'),
  });
  const deleteMutation = useMutation({
    mutationFn: (awardId: number) => deleteBonusAward(joinCode, awardId),
    onSuccess: invalidate,
    onError: toastFailure('Could not delete bonus award'),
  });
  return { updateMutation, deleteMutation };
}

function CoinAwardsList({
  coinAwards,
}: {
  coinAwards: NonNullable<
    Awaited<ReturnType<typeof fetchBonusAwards>>
  >['coinAwards'];
}) {
  if (coinAwards.length === 0) return null;
  return (
    <>
      <h3 className="text-sm font-extrabold">Coin awards</h3>
      <ul
        aria-label="Coin awards"
        className="flex max-h-40 flex-col gap-2 overflow-y-auto"
      >
        {coinAwards.map((coinAward) => (
          <li
            key={coinAward.id}
            className="flex flex-col gap-0.5 rounded-lg border border-background/20 bg-background/5 p-2.5 text-xs"
          >
            <span className="font-bold">
              {coinAward.coins > 0 ? '+' : ''}
              {formatCoins(coinAward.coins)}
            </span>
            {coinAward.reason && (
              <span className="text-background/70">{coinAward.reason}</span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
