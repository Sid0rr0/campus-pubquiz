import type { AnswersUpdatedPayload } from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';

export class AnswerApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AnswerApiError';
  }
}

export async function fetchAnswers(
  joinCode: string,
  questionId: number,
): Promise<AnswersUpdatedPayload> {
  const response = await fetch(
    `${getBackendUrl()}/sessions/${joinCode}/answers/${questionId}`,
    { credentials: 'include' },
  );

  if (!response.ok) {
    const body = (await response.json()) as { message?: string };
    throw new AnswerApiError(body.message ?? 'Could not load answers', response.status);
  }

  return (await response.json()) as AnswersUpdatedPayload;
}
