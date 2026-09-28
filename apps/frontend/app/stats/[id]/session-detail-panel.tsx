'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchSessionDetail, StatsApiError } from '@/app/lib/stats-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { HighlightTiles } from '@/app/stats/[id]/highlight-tiles';
import { StandingsTable } from '@/app/stats/[id]/standings-table';
import { RoundsTable } from '@/app/stats/[id]/rounds-table';
import { QuestionsTable } from '@/app/stats/[id]/questions-table';

interface SessionDetailPanelProps {
  gameSessionId: number;
}

export function SessionDetailPanel({ gameSessionId }: SessionDetailPanelProps) {
  const detailQuery = useQuery({
    queryKey: queryKeys.stats.session(gameSessionId),
    queryFn: ({ signal }) => fetchSessionDetail(gameSessionId, signal),
  });
  const data = detailQuery.data ?? null;
  const error = apiErrorMessage(
    detailQuery.error,
    StatsApiError,
    'Could not load session detail',
  );

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        {error ? (
          <p role="alert" className="font-extrabold text-magenta">
            {error}
          </p>
        ) : (
          <p className="font-display text-xl">Loading…</p>
        )}
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-background p-6 text-foreground">
      <div className="flex flex-col gap-1">
        <Link
          href="/stats"
          className="text-sm text-foreground/60 underline-offset-2 hover:underline"
        >
          ← Back to stats
        </Link>
        <h1 className="font-display text-2xl">{data.name}</h1>
        <p className="text-sm text-foreground/60">
          {new Date(data.playedAt).toLocaleString()} · {data.joinCode} ·{' '}
          {data.teamCount} team{data.teamCount === 1 ? '' : 's'}
        </p>
      </div>

      {error && (
        <p role="alert" className="font-extrabold text-magenta">
          {error}
        </p>
      )}

      <HighlightTiles data={data} />

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg">Standings</h2>
        <StandingsTable standings={data.standings} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg">Rounds</h2>
        <RoundsTable
          rounds={data.rounds}
          hardestRoundId={data.highlights.hardestRoundId}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg">Questions</h2>
        <QuestionsTable
          questions={data.questions}
          allCorrectQuestionIds={data.highlights.allCorrectQuestionIds}
          noneCorrectQuestionIds={data.highlights.noneCorrectQuestionIds}
        />
      </section>
    </main>
  );
}
