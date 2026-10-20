'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchTeamDetail, TeamsApiError } from '@/app/lib/teams-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { SummaryTiles } from '@/app/teams/[id]/summary-tiles';
import { TeamSessionsTable } from '@/app/teams/[id]/team-sessions-table';

const NOT_FOUND_STATUS = 404;

function CenteredMessage({
  children,
  isAlert = false,
}: {
  children: string;
  isAlert?: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      {isAlert ? (
        <p role="alert" className="font-extrabold text-magenta">
          {children}
        </p>
      ) : (
        <p className="font-display text-xl">{children}</p>
      )}
    </main>
  );
}

interface TeamDetailPanelProps {
  teamId: number;
}

export function TeamDetailPanel({ teamId }: TeamDetailPanelProps) {
  const detailQuery = useQuery({
    queryKey: queryKeys.teams.detail(teamId),
    queryFn: ({ signal }) => fetchTeamDetail(teamId, signal),
  });
  const data = detailQuery.data ?? null;

  if (!data) {
    const queryError: unknown = detailQuery.error;
    if (
      queryError instanceof TeamsApiError &&
      queryError.status === NOT_FOUND_STATUS
    ) {
      return <CenteredMessage>Team not found.</CenteredMessage>;
    }
    const error = apiErrorMessage(
      queryError,
      TeamsApiError,
      'Could not load team',
    );
    return error ? (
      <CenteredMessage isAlert>{error}</CenteredMessage>
    ) : (
      <CenteredMessage>Loading…</CenteredMessage>
    );
  }

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-background p-6 text-foreground">
      <div className="flex flex-col gap-1">
        <Link
          href="/teams"
          className="text-sm text-foreground/60 underline-offset-2 hover:underline"
        >
          ← Back to teams
        </Link>
        <h1 className="font-display text-2xl">{data.name}</h1>
      </div>

      {data.sessions.length === 0 ? (
        <p className="text-foreground/60">
          This team hasn&apos;t played an ended session yet.
        </p>
      ) : (
        <>
          <SummaryTiles summary={data.summary} />
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-lg">Sessions</h2>
            <TeamSessionsTable sessions={data.sessions} />
          </section>
        </>
      )}
    </main>
  );
}
