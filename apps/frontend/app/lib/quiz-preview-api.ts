import type {
  QuizPreviewMode,
  QuizPreviewPayload,
} from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';
import { ApiError, errorMessageOf } from '@/app/lib/api-error';

export class QuizPreviewApiError extends ApiError {}

export async function fetchQuizPreview(
  quizId: number,
  mode: QuizPreviewMode,
  withJokers: boolean,
  signal?: AbortSignal,
): Promise<QuizPreviewPayload> {
  const query = new URLSearchParams({ mode });
  if (withJokers) query.set('jokers', 'true');
  const response = await fetch(
    `${getBackendUrl()}/quizzes/${quizId}/preview?${query}`,
    { credentials: 'include', signal },
  );
  if (!response.ok) {
    throw new QuizPreviewApiError(
      await errorMessageOf(response, 'Could not load the quiz preview'),
      response.status,
    );
  }
  return (await response.json()) as QuizPreviewPayload;
}
