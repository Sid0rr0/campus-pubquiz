import type {
  LeagueFields,
  LeaguesListedPayload,
  LeagueTable,
  LeagueView,
  PublicLeaguesPayload,
} from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';
import { CSRF_HEADERS } from '@/app/lib/csrf-headers';

export class LeaguesApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'LeaguesApiError';
  }
}

async function throwApiError(
  response: Response,
  fallback: string,
): Promise<never> {
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
  };
  throw new LeaguesApiError(body.message ?? fallback, response.status);
}

const JSON_HEADERS = { 'Content-Type': 'application/json', ...CSRF_HEADERS };

/** Staff read; `current` keeps only leagues whose end date is today or later. */
export async function fetchLeagues(
  options: { current?: boolean } = {},
  signal?: AbortSignal,
): Promise<LeaguesListedPayload> {
  const query = options.current ? '?current=true' : '';
  const response = await fetch(`${getBackendUrl()}/leagues${query}`, {
    credentials: 'include',
    signal,
  });
  if (!response.ok) return throwApiError(response, 'Could not load leagues');
  return (await response.json()) as LeaguesListedPayload;
}

/** Public (no login): every league, current ones first. */
export async function fetchPublicLeagues(
  signal?: AbortSignal,
): Promise<PublicLeaguesPayload> {
  const response = await fetch(`${getBackendUrl()}/leagues/public`, { signal });
  if (!response.ok) return throwApiError(response, 'Could not load leagues');
  return (await response.json()) as PublicLeaguesPayload;
}

/** Public (no login): one league's table. */
export async function fetchLeagueTable(
  leagueId: number,
  signal?: AbortSignal,
): Promise<LeagueTable> {
  const response = await fetch(`${getBackendUrl()}/leagues/${leagueId}/table`, {
    signal,
  });
  if (!response.ok) return throwApiError(response, 'Could not load the table');
  return (await response.json()) as LeagueTable;
}

export async function createLeague(fields: LeagueFields): Promise<LeagueView> {
  const response = await fetch(`${getBackendUrl()}/leagues`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(fields),
  });
  if (!response.ok) return throwApiError(response, 'Could not create league');
  return (await response.json()) as LeagueView;
}

export async function updateLeague(
  leagueId: number,
  fields: LeagueFields,
): Promise<LeagueView> {
  const response = await fetch(`${getBackendUrl()}/leagues/${leagueId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(fields),
  });
  if (!response.ok) return throwApiError(response, 'Could not update league');
  return (await response.json()) as LeagueView;
}

export async function deleteLeague(leagueId: number): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/leagues/${leagueId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: CSRF_HEADERS,
  });
  if (!response.ok) return throwApiError(response, 'Could not delete league');
}

export async function addLeagueSession(
  leagueId: number,
  gameSessionId: number,
): Promise<void> {
  const response = await fetch(
    `${getBackendUrl()}/leagues/${leagueId}/sessions`,
    {
      method: 'POST',
      credentials: 'include',
      headers: JSON_HEADERS,
      body: JSON.stringify({ gameSessionId }),
    },
  );
  if (!response.ok) return throwApiError(response, 'Could not add session');
}

export async function removeLeagueSession(
  leagueId: number,
  gameSessionId: number,
): Promise<void> {
  const response = await fetch(
    `${getBackendUrl()}/leagues/${leagueId}/sessions/${gameSessionId}`,
    { method: 'DELETE', credentials: 'include', headers: CSRF_HEADERS },
  );
  if (!response.ok) return throwApiError(response, 'Could not remove session');
}
