'use client';

import { useQuery } from '@tanstack/react-query';
import type { LeagueView } from '@campus-pubquiz/types';
import { fetchLeagues } from '@/app/lib/leagues-api';
import { queryKeys } from '@/app/lib/query-keys';

interface TickableLeagues {
  /** Current leagues, plus any league the session is already in. */
  leagues: LeagueView[];
  /** Ids of the leagues the session is already in. */
  memberOf: number[];
}

/**
 * The leagues staff can tick for a session. A session being created has no
 * memberships, so only current leagues are fetched; for a live session
 * (`joinCode`) every league is fetched so one it is already in stays visible
 * after the league stops being current.
 */
export function useTickableLeagues(joinCode?: string): TickableLeagues {
  const { data } = useQuery({
    queryKey: queryKeys.leagues.list(joinCode === undefined),
    queryFn: ({ signal }) =>
      fetchLeagues({ current: joinCode === undefined }, signal),
  });
  const isMember = (league: LeagueView) =>
    joinCode !== undefined &&
    league.sessions.some((session) => session.joinCode === joinCode);
  const leagues = (data?.items ?? []).filter(
    (league) => league.current || isMember(league),
  );
  return {
    leagues,
    memberOf: leagues.filter(isMember).map((league) => league.id),
  };
}

interface LeagueCheckboxesProps {
  leagues: LeagueView[];
  selected: number[];
  onChange: (leagueIds: number[]) => void;
}

/** One checkbox per league the session may count towards; renders nothing when there are none. */
export function LeagueCheckboxes({
  leagues,
  selected,
  onChange,
}: LeagueCheckboxesProps) {
  if (leagues.length === 0) return null;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-extrabold">Leagues</legend>
      {leagues.map((league) => (
        <label
          key={league.id}
          className="flex min-h-10 items-center gap-2 text-sm"
        >
          <input
            type="checkbox"
            checked={selected.includes(league.id)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, league.id]
                  : selected.filter((id) => id !== league.id),
              )
            }
          />
          {league.name}
        </label>
      ))}
    </fieldset>
  );
}
