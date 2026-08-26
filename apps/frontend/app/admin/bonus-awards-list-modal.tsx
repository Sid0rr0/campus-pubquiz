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
import { ConfirmDialog } from '@/app/components/confirm-dialog';

interface AwardRowProps {
  award: BonusAwardAdminView;
  onSave: (points: number, reason?: string) => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}

/** One award, either showing its details or (while editing) an inline points/reason form — same validation as BonusAwardForm: non-zero finite points, non-empty reason only for category "custom". Category itself is read-only. */
function AwardRow({ award, onSave, onDelete, isSaving, isDeleting }: AwardRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [pointsInput, setPointsInput] = useState(String(award.points));
  const [reasonInput, setReasonInput] = useState(award.reason ?? '');
  const label = BONUS_CATEGORY_LABELS[award.category];
  const isCustom = award.category === 'custom';

  const points = Number(pointsInput);
  const canSubmit =
    Number.isFinite(points) &&
    points !== 0 &&
    (!isCustom || reasonInput.trim().length > 0);

  function startEditing(): void {
    setPointsInput(String(award.points));
    setReasonInput(award.reason ?? '');
    setIsEditing(true);
  }

  function handleSave(): void {
    if (!canSubmit) return;
    onSave(points, isCustom ? reasonInput.trim() : undefined);
    setIsEditing(false);
  }

  if (isEditing) {
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
            onClick={() => setIsEditing(false)}
            className="font-bold text-background/70"
          >
            Cancel
          </Button>
        </div>
      </li>
    );
  }

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
          onClick={startEditing}
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
 * edit (points + reason) and delete per row. Leaderboard totals update on
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
  const queryClient = useQueryClient();
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

  function invalidate(): void {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.bonusAwards.forTeam(joinCode, resolvedTeamId),
    });
  }

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
    onError: (mutationError) =>
      toast.error(
        apiErrorMessage(
          mutationError,
          BonusAwardApiError,
          'Could not update bonus award',
        ) ?? 'Could not update bonus award',
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (awardId: number) => deleteBonusAward(joinCode, awardId),
    onSuccess: invalidate,
    onError: (mutationError) =>
      toast.error(
        apiErrorMessage(
          mutationError,
          BonusAwardApiError,
          'Could not delete bonus award',
        ) ?? 'Could not delete bonus award',
      ),
  });

  const awards = awardsQuery.data?.awards ?? [];

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
          {error && (
            <p role="alert" className="text-sm font-bold text-magenta">
              {error}
            </p>
          )}
          {!error && awards.length === 0 && (
            <p className="text-sm text-background/60">No bonus awards yet.</p>
          )}
          {awards.length > 0 && (
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {awards.map((award) => (
                <AwardRow
                  key={award.id}
                  award={award}
                  isSaving={
                    updateMutation.isPending &&
                    updateMutation.variables?.awardId === award.id
                  }
                  isDeleting={
                    deleteMutation.isPending &&
                    deleteMutation.variables === award.id
                  }
                  onSave={(points, reason) =>
                    updateMutation.mutate({ awardId: award.id, points, reason })
                  }
                  onDelete={() => deleteMutation.mutate(award.id)}
                />
              ))}
            </ul>
          )}
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
