import type { QuizzesListedPayload } from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';
import { CSRF_HEADERS } from '@/app/lib/csrf-headers';
import { ApiError, errorMessageOf } from '@/app/lib/api-error';

export class QuizApiError extends ApiError {}

export async function fetchQuizzes(
  joinCode?: string,
): Promise<QuizzesListedPayload> {
  const query = joinCode ? `?joinCode=${encodeURIComponent(joinCode)}` : '';
  const response = await fetch(`${getBackendUrl()}/quizzes${query}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new QuizApiError(
      await errorMessageOf(response, 'Could not load quizzes'),
      response.status,
    );
  }

  return (await response.json()) as QuizzesListedPayload;
}

export async function deleteQuiz(quizId: number): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/quizzes/${quizId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: CSRF_HEADERS,
  });
  if (!response.ok) {
    throw new QuizApiError(
      await errorMessageOf(response, 'Could not delete quiz'),
      response.status,
    );
  }
}
