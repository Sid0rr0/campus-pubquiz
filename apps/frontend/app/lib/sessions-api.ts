import type {
  ActiveSessionSummary,
  CreateSessionPayload,
  SessionSettings,
} from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';
import { CSRF_HEADERS } from '@/app/lib/csrf-headers';

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
    throw new SessionApiError(
      body.message ?? 'Session request failed',
      response.status,
    );
  }
  return (await response.json()) as T;
}

export async function fetchSessions(): Promise<ActiveSessionSummary[]> {
  const response = await fetch(`${getBackendUrl()}/sessions`, {
    credentials: 'include',
  });
  return handleResponse<ActiveSessionSummary[]>(response);
}

/** Unauthenticated variant for /display, which runs on venue TV/projector hardware with no admin login of its own. */
export async function fetchPublicSessions(): Promise<ActiveSessionSummary[]> {
  const response = await fetch(`${getBackendUrl()}/sessions/public`);
  return handleResponse<ActiveSessionSummary[]>(response);
}

export async function createSession(
  quizId: number,
  settings?: Partial<SessionSettings>,
): Promise<ActiveSessionSummary> {
  const payload: CreateSessionPayload = { quizId, settings };
  const response = await fetch(`${getBackendUrl()}/sessions`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...CSRF_HEADERS,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse<ActiveSessionSummary>(response);
}

export async function updateSessionSettings(
  joinCode: string,
  settings: Partial<SessionSettings>,
): Promise<void> {
  const response = await fetch(
    `${getBackendUrl()}/sessions/${joinCode}/settings`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...CSRF_HEADERS,
      },
      body: JSON.stringify(settings),
    },
  );
  if (!response.ok) {
    const body = (await response.json()) as { message?: string };
    throw new SessionApiError(
      body.message ?? 'Could not update session settings',
      response.status,
    );
  }
}

export async function closeSession(joinCode: string): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/sessions/${joinCode}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: CSRF_HEADERS,
  });
  if (!response.ok) {
    const body = (await response.json()) as { message?: string };
    throw new SessionApiError(
      body.message ?? 'Could not close session',
      response.status,
    );
  }
}
