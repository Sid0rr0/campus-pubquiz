import type {
  QuizPreviewMode,
  QuizPreviewPayload,
} from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';

export class QuizPreviewApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'QuizPreviewApiError';
  }
}

interface ErrorBody {
  message?: string;
}

export async function fetchQuizPreview(
  quizId: number,
  mode: QuizPreviewMode,
  signal?: AbortSignal,
): Promise<QuizPreviewPayload> {
  const query = new URLSearchParams({ mode });
  const response = await fetch(
    `${getBackendUrl()}/quizzes/${quizId}/preview?${query}`,
    { credentials: 'include', signal },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    throw new QuizPreviewApiError(
      body.message ?? 'Could not load the quiz preview',
      response.status,
    );
  }
  return (await response.json()) as QuizPreviewPayload;
}
