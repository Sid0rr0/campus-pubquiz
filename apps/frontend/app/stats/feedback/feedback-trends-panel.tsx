'use client';

import { useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchFeedbackTrends, StatsApiError } from '@/app/lib/stats-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { RatingsOverTimeTable } from '@/app/stats/feedback/ratings-over-time-table';
import { TopicSuggestionsList } from '@/app/stats/feedback/topic-suggestions-list';

const DATE_INPUT_CLASS =
  'min-h-10 rounded-lg border border-foreground/20 px-3 text-sm font-normal';

/** Feedback across many ended sessions for a chosen date range (all time by default). */
export function FeedbackTrendsPanel() {
  const [range, setRange] = useState({ from: '', to: '' });

  const trendsQuery = useQuery({
    queryKey: queryKeys.stats.feedbackTrends(range),
    queryFn: ({ signal }) => fetchFeedbackTrends(range, signal),
    placeholderData: keepPreviousData,
  });
  const data = trendsQuery.data ?? null;
  const error = apiErrorMessage(
    trendsQuery.error,
    StatsApiError,
    'Could not load feedback trends',
  );

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-background p-6 text-foreground">
      <div className="flex flex-col gap-1">
        <Link
          href="/stats"
          className="text-sm text-foreground/60 underline-offset-2 hover:underline"
        >
          ← Back to stats
        </Link>
        <h1 className="font-display text-2xl">Feedback trends</h1>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-extrabold">
          From
          <input
            type="date"
            value={range.from}
            max={range.to || undefined}
            onChange={(event) =>
              setRange((old) => ({ ...old, from: event.target.value }))
            }
            className={DATE_INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-extrabold">
          To
          <input
            type="date"
            value={range.to}
            min={range.from || undefined}
            onChange={(event) =>
              setRange((old) => ({ ...old, to: event.target.value }))
            }
            className={DATE_INPUT_CLASS}
          />
        </label>
        {(range.from || range.to) && (
          <button
            type="button"
            onClick={() => setRange({ from: '', to: '' })}
            className="min-h-10 text-sm underline-offset-2 hover:underline"
          >
            All time
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="font-extrabold text-magenta">
          {error}
        </p>
      )}

      {data ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg">Ratings over time</h2>
          <RatingsOverTimeTable sessions={data.sessions} />
        </section>
      ) : (
        !error && <p className="font-display text-xl">Loading…</p>
      )}

      {data && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg">Topic suggestions</h2>
          <TopicSuggestionsList topics={data.topics} />
        </section>
      )}
    </main>
  );
}
