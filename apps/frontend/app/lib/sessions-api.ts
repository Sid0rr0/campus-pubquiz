import type { ActiveSessionSummary, CreateSessionPayload } from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';

export class SessionApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'SessionApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json()) as { message?: string };
    throw new SessionApiError(body.message ?? 'Session request failed', response.status);
  }
  return (await response.json()) as T;
}

export async function fetchSessions(): Promise<ActiveSessionSummary[]> {
  const response = await fetch(`${getBackendUrl()}/sessions`, {
    credentials: 'include',
  });
  return handleResponse<ActiveSessionSummary[]>(response);
}

export async function createSession(quizId: number): Promise<ActiveSessionSummary> {
  const payload: CreateSessionPayload = { quizId };
  const response = await fetch(`${getBackendUrl()}/sessions`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return handleResponse<ActiveSessionSummary>(response);
}

export async function closeSession(joinCode: string): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/sessions/${joinCode}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const body = (await response.json()) as { message?: string };
    throw new SessionApiError(body.message ?? 'Could not close session', response.status);
  }
}
