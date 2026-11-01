import type { AnswersUpdatedPayload } from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';
import { ApiError, errorMessageOf } from '@/app/lib/api-error';

export class AnswerApiError extends ApiError {}

export async function fetchAnswers(
  joinCode: string,
  questionId: number,
): Promise<AnswersUpdatedPayload> {
  const response = await fetch(
    `${getBackendUrl()}/sessions/${joinCode}/answers/${questionId}`,
    { credentials: 'include' },
  );

  if (!response.ok) {
    throw new AnswerApiError(
      await errorMessageOf(response, 'Could not load answers'),
      response.status,
    );
  }

  return (await response.json()) as AnswersUpdatedPayload;
}
