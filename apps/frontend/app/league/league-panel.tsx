'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LeagueTable, PublicLeague } from '@campus-pubquiz/types';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import {
  fetchLeagueTable,
  fetchPublicLeagues,
  LeaguesApiError,
} from '@/app/lib/leagues-api';
import { queryKeys } from '@/app/lib/query-keys';

function LeagueTabs({
  leagues,
  selectedId,
  onSelect,
}: {
  leagues: PublicLeague[];
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {leagues.map((league) => (
        <li key={league.id}>
          <button
            type="button"
            aria-pressed={league.id === selectedId}
            onClick={() => onSelect(league.id)}
            className={`rounded-2xl border-2 px-3 py-1 font-bold ${
              league.id === selectedId
                ? 'border-foreground bg-foreground text-background'
                : 'border-foreground/35'
            }`}
          >
            {league.name}
            {!league.current && (
              <span className="ml-2 text-xs font-normal">ended</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function TableView({ table }: { table: LeagueTable }) {
  if (table.rows.length === 0) {
    return (
      <p className="text-foreground/70">
        No results yet: a league table appears once a quiz night in this league
        has finished.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-96 border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-foreground/25 text-xs tracking-wide text-foreground/55">
            <th scope="col" className="py-2 pr-3">
              #
            </th>
            <th scope="col" className="py-2 pr-3">
              Team
            </th>
            <th scope="col" className="py-2 pr-3">
              Points
            </th>
            <th scope="col" className="py-2 pr-3">
              Played
            </th>
            <th scope="col" className="py-2 pr-3">
              Won
            </th>
            <th scope="col" className="py-2">
              Avg placing
            </th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.teamId} className="border-b border-foreground/10">
              <td className="py-2 pr-3 font-extrabold">{row.position}</td>
              <td className="py-2 pr-3 font-bold">{row.teamName}</td>
              <td className="py-2 pr-3 font-extrabold">{row.leaguePoints}</td>
              <td className="py-2 pr-3">{row.nightsPlayed}</td>
              <td className="py-2 pr-3">{row.nightsWon}</td>
              <td className="py-2">
                {row.averagePlacing === null ? '–' : row.averagePlacing}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SelectedLeague({ league }: { league: PublicLeague }) {
  const tableQuery = useQuery({
    queryKey: queryKeys.leagues.table(league.id),
    queryFn: ({ signal }) => fetchLeagueTable(league.id, signal),
  });
  const error = apiErrorMessage(
    tableQuery.error,
    LeaguesApiError,
    'Could not load the table',
  );
  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-foreground/60">
        {league.startsOn} to {league.endsOn}
      </p>
      {error && (
        <p role="alert" className="font-extrabold text-magenta">
          {error}
        </p>
      )}
      {tableQuery.data && <TableView table={tableQuery.data} />}
    </section>
  );
}

function LeagueRules() {
  return (
    <section
      aria-labelledby="league-rules-heading"
      className="mt-4 flex flex-col gap-2 border-t-2 border-foreground/15 pt-4"
    >
      <h2 id="league-rules-heading" className="font-display text-xl">
        How league points work
      </h2>
      <p className="text-foreground/80">
        Every finished quiz night in a league gives each team that played it:
      </p>
      <ul className="list-disc pl-6 text-foreground/80">
        <li>
          <strong>5, 4, 3, 2 or 1 points</strong> for finishing 1st, 2nd, 3rd,
          4th or 5th. Teams tied on a place each get that place&apos;s full
          points. Nothing below 5th.
        </li>
        <li>
          <strong>1 participation point</strong> for answering at least one
          question.
        </li>
      </ul>
      <p className="text-foreground/80">
        Teams are ranked by league points. If they are level, the team that won
        more nights ranks higher, then the one with the better average placing.
        Teams still level share the position.
      </p>
    </section>
  );
}

/** The public league page: current leagues first, then the rest, and the selected league's table. */
export function LeaguePanel() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const leaguesQuery = useQuery({
    queryKey: queryKeys.leagues.publicList(),
    queryFn: ({ signal }) => fetchPublicLeagues(signal),
  });
  const error = apiErrorMessage(
    leaguesQuery.error,
    LeaguesApiError,
    'Could not load leagues',
  );
  const leagues = leaguesQuery.data?.items ?? [];
  const selected =
    leagues.find((league) => league.id === selectedId) ?? leagues[0];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 bg-background p-6 text-foreground">
      <h1 className="font-display text-2xl">League</h1>
      {error && (
        <p role="alert" className="font-extrabold text-magenta">
          {error}
        </p>
      )}
      {leaguesQuery.isSuccess && leagues.length === 0 && (
        <p className="text-foreground/70">
          No leagues yet. Check back once the season starts.
        </p>
      )}
      {selected && (
        <>
          {leagues.length > 1 && (
            <LeagueTabs
              leagues={leagues}
              selectedId={selected.id}
              onSelect={setSelectedId}
            />
          )}
          <h2 className="font-display text-xl">{selected.name}</h2>
          <SelectedLeague key={selected.id} league={selected} />
        </>
      )}
      <LeagueRules />
    </main>
  );
}
