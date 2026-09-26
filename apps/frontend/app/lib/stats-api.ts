import type { PlayedSessionStats } from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';

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
