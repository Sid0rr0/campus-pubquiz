import type {
  TeamCodeView,
  TeamDetail,
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

/** The public team page's history. The code goes in the POST body, never a URL, and no cookie is sent. */
export async function fetchTeamPage(
  teamCode: string,
  signal?: AbortSignal,
): Promise<TeamPageHistory> {
  const response = await fetch(`${getBackendUrl()}/team-page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamCode }),
    signal,
  });
  if (!response.ok) return throwApiError(response, 'Could not load team page');
  return (await response.json()) as TeamPageHistory;
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
