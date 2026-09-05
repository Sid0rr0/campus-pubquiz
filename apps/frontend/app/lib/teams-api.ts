import type {
  TeamCodeView,
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

export interface FetchTeamsParams {
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
