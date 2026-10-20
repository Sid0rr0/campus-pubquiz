import type {
  TeamCodeView,
  TeamDetail,
  TeamNightDetail,
  TeamPageHistory,
  TeamsListedPayload,
  TeamsSortColumn,
  TeamsSortOrder,
} from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';

export class TeamsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'TeamsApiError';
  }
}

interface ErrorBody {
  message?: string;
}

async function throwApiError(
  response: Response,
  fallback: string,
): Promise<never> {
  const body = (await response.json().catch(() => ({}))) as ErrorBody;
  throw new TeamsApiError(body.message ?? fallback, response.status);
}

interface FetchTeamsParams {
  page: number;
  pageSize: number;
  sortBy: TeamsSortColumn;
  sortOrder: TeamsSortOrder;
}

export async function fetchTeams(
  params: FetchTeamsParams,
  signal?: AbortSignal,
): Promise<TeamsListedPayload> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  });
  const response = await fetch(`${getBackendUrl()}/teams?${query}`, {
    credentials: 'include',
    signal,
  });
  if (!response.ok) return throwApiError(response, 'Could not load teams');
  return (await response.json()) as TeamsListedPayload;
}

export async function fetchTeamDetail(
  teamId: number,
  signal?: AbortSignal,
): Promise<TeamDetail> {
  const response = await fetch(`${getBackendUrl()}/teams/${teamId}`, {
    credentials: 'include',
    signal,
  });
  if (!response.ok) return throwApiError(response, 'Could not load team');
  return (await response.json()) as TeamDetail;
}

/** POSTs a team code to the public team page. The code goes in the body, never a URL, and no cookie is sent. */
async function postTeamCode<T>(
  path: string,
  teamCode: string,
  fallback: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${getBackendUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamCode }),
    signal,
  });
  if (!response.ok) return throwApiError(response, fallback);
  return (await response.json()) as T;
}

/** The public team page's history. */
export function fetchTeamPage(
  teamCode: string,
  signal?: AbortSignal,
): Promise<TeamPageHistory> {
  return postTeamCode(
    '/team-page',
    teamCode,
    'Could not load team page',
    signal,
  );
}

/** One ended night of the public team page. */
export function fetchTeamNight(
  teamCode: string,
  gameSessionId: number,
  signal?: AbortSignal,
): Promise<TeamNightDetail> {
  return postTeamCode(
    `/team-page/sessions/${gameSessionId}`,
    teamCode,
    'Could not load this night',
    signal,
  );
}

export async function fetchTeamCode(
  teamId: number,
  signal?: AbortSignal,
): Promise<TeamCodeView> {
  const response = await fetch(`${getBackendUrl()}/teams/${teamId}/code`, {
    credentials: 'include',
    signal,
  });
  if (!response.ok) {
    return throwApiError(response, 'Could not load team code');
  }
  return (await response.json()) as TeamCodeView;
}
