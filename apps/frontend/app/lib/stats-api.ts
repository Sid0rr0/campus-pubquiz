import type {
  PlayedSessionStats,
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

export async function fetchPlayedSessions(
  signal?: AbortSignal,
): Promise<PlayedSessionStats[]> {
  const response = await fetch(`${getBackendUrl()}/stats/sessions`, {
    credentials: 'include',
    signal,
  });
  if (!response.ok) {
    return throwApiError(response, 'Could not load session stats');
  }
  return (await response.json()) as PlayedSessionStats[];
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
