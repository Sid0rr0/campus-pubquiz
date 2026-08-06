import type { QuizzesListedPayload } from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';

export class QuizApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'QuizApiError';
  }
}

export async function fetchQuizzes(joinCode?: string): Promise<QuizzesListedPayload> {
  const query = joinCode ? `?joinCode=${encodeURIComponent(joinCode)}` : '';
  const response = await fetch(`${getBackendUrl()}/quizzes${query}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const body = (await response.json()) as { message?: string };
    throw new QuizApiError(body.message ?? 'Could not load quizzes', response.status);
  }

  return (await response.json()) as QuizzesListedPayload;
}
