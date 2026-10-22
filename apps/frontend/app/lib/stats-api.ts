import type {
  FeedbackTrends,
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

/** The Night brief of an ended session: Markdown text. */
export async function fetchSessionBrief(
  gameSessionId: number,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(
    `${getBackendUrl()}/stats/sessions/${gameSessionId}/brief`,
    { credentials: 'include', signal },
  );
  if (!response.ok) {
    return throwApiError(response, 'Could not load the Night brief');
  }
  return response.text();
}

/**
 * Both bounds are `YYYY-MM-DD` dates (UTC); an empty string means no bound.
 * A `leagueId` means that league's member sessions and wins over the bounds.
 */
export interface FeedbackTrendsRange {
  from: string;
  to: string;
  leagueId?: number;
}

export async function fetchFeedbackTrends(
  range: FeedbackTrendsRange,
  signal?: AbortSignal,
): Promise<FeedbackTrends> {
  const query = new URLSearchParams();
  if (range.leagueId !== undefined) {
    query.set('leagueId', String(range.leagueId));
  } else {
    if (range.from) query.set('from', range.from);
    if (range.to) query.set('to', range.to);
  }
  const response = await fetch(
    `${getBackendUrl()}/stats/feedback-trends?${query}`,
    { credentials: 'include', signal },
  );
  if (!response.ok) {
    return throwApiError(response, 'Could not load feedback trends');
  }
  return (await response.json()) as FeedbackTrends;
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

/** A blank name clears the session's custom name, falling back to showing the quiz's own title. */
export async function renameSession(
  gameSessionId: number,
  name: string,
): Promise<void> {
  const response = await fetch(
    `${getBackendUrl()}/stats/sessions/${gameSessionId}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
      body: JSON.stringify({ name }),
    },
  );
  if (!response.ok) {
    return throwApiError(response, 'Could not rename session');
  }
}
