'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchTeamCode, TeamsApiError } from '@/app/lib/teams-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { TeamCodeDialog } from '@/app/control/team-code-dialog';

interface TeamCodeModalProps {
  /** null closes the dialog — same convention TeamsTable already uses for its other per-team dialogs. */
  teamId: number | null;
  teamName: string;
  /** The live session's join code, folded into the dialog's QR code so scanning it prefills both fields on /play. */
  joinCode?: string;
  onOpenChange: (open: boolean) => void;
}

/** Fetches and shows one team's persistent join code on demand, so it isn't carried on every live game-state broadcast. */
export function TeamCodeModal({
  teamId,
  teamName,
  joinCode,
  onOpenChange,
}: TeamCodeModalProps) {
  const isOpen = teamId !== null;
  const resolvedTeamId = teamId ?? -1;

  const codeQuery = useQuery({
    queryKey: queryKeys.teams.code(resolvedTeamId),
    queryFn: ({ signal }) => fetchTeamCode(resolvedTeamId, signal),
    enabled: isOpen,
  });
  const error = apiErrorMessage(
    codeQuery.error,
    TeamsApiError,
    'Could not load team code',
  );

  return (
    <TeamCodeDialog
      open={isOpen}
      teamName={teamName}
      code={codeQuery.data?.code ?? null}
      joinCode={joinCode}
      error={error}
      onOpenChange={onOpenChange}
    />
  );
}
