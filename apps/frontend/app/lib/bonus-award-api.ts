import type {
  BonusAwardAdminView,
  BonusAwardsListedPayload,
} from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';
import { CSRF_HEADERS } from '@/app/lib/csrf-headers';

export class BonusAwardApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'BonusAwardApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new BonusAwardApiError(
      body.message ?? 'Bonus award request failed',
      response.status,
    );
  }
  return (await response.json()) as T;
}

export async function fetchBonusAwards(
  joinCode: string,
  teamId: number,
): Promise<BonusAwardsListedPayload> {
  const response = await fetch(
    `${getBackendUrl()}/sessions/${joinCode}/teams/${teamId}/bonus-awards`,
    { credentials: 'include' },
  );
  return handleResponse<BonusAwardsListedPayload>(response);
}

export async function updateBonusAward(
  joinCode: string,
  awardId: number,
  points: number,
  reason?: string,
): Promise<BonusAwardAdminView> {
  const response = await fetch(
    `${getBackendUrl()}/sessions/${joinCode}/bonus-awards/${awardId}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...CSRF_HEADERS,
      },
      body: JSON.stringify({ points, reason }),
    },
  );
  return handleResponse<BonusAwardAdminView>(response);
}

export async function deleteBonusAward(
  joinCode: string,
  awardId: number,
): Promise<void> {
  const response = await fetch(
    `${getBackendUrl()}/sessions/${joinCode}/bonus-awards/${awardId}`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: CSRF_HEADERS,
    },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new BonusAwardApiError(
      body.message ?? 'Could not delete bonus award',
      response.status,
    );
  }
}
