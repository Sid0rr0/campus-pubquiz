import type {
  PlayedSessionsListedPayload,
  PlayedSessionsSortColumn,
  PlayedSessionsSortOrder,
  SessionDetailStats,
} from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';
import { CSRF_HEADERS } from '@/app/lib/csrf-headers';

export class StatsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'StatsApiError';
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
  throw new StatsApiError(body.message ?? fallback, response.status);
}

interface FetchPlayedSessionsParams {
  page: number;
  pageSize: number;
  sortBy: PlayedSessionsSortColumn;
  sortOrder: PlayedSessionsSortOrder;
}

export async function fetchPlayedSessions(
  params: FetchPlayedSessionsParams,
  signal?: AbortSignal,
): Promise<PlayedSessionsListedPayload> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  });
  const response = await fetch(`${getBackendUrl()}/stats/sessions?${query}`, {
    credentials: 'include',
    signal,
  });
  if (!response.ok) {
    return throwApiError(response, 'Could not load session stats');
  }
  return (await response.json()) as PlayedSessionsListedPayload;
}

export async function fetchSessionDetail(
  gameSessionId: number,
  signal?: AbortSignal,
): Promise<SessionDetailStats> {
  const response = await fetch(
    `${getBackendUrl()}/stats/sessions/${gameSessionId}`,
    { credentials: 'include', signal },
  );
  if (!response.ok) {
    return throwApiError(response, 'Could not load session detail');
  }
  return (await response.json()) as SessionDetailStats;
}

export async function deleteSession(gameSessionId: number): Promise<void> {
  const response = await fetch(
    `${getBackendUrl()}/stats/sessions/${gameSessionId}`,
    { method: 'DELETE', credentials: 'include', headers: CSRF_HEADERS },
  );
  if (!response.ok) {
    return throwApiError(response, 'Could not delete session');
  }
}
