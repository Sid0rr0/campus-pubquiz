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

export async function fetchQuizzes(adminPassword: string): Promise<QuizzesListedPayload> {
  const response = await fetch(`${getBackendUrl()}/quizzes`, {
    headers: { 'x-admin-password': adminPassword },
  });

  if (!response.ok) {
    const body = (await response.json()) as { message?: string };
    throw new QuizApiError(body.message ?? 'Could not load quizzes', response.status);
  }

  return (await response.json()) as QuizzesListedPayload;
}
