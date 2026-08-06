import type {
  QuizDraft,
  QuizDraftIssue,
  QuizDraftSaveRequest,
  QuizDraftSaveResult,
} from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';
import { CSRF_HEADERS } from '@/app/lib/csrf-headers';

export class QuizDraftApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly issues: QuizDraftIssue[] = [],
  ) {
    super(message);
    this.name = 'QuizDraftApiError';
  }
}

interface ErrorBody {
  message?: string;
  issues?: QuizDraftIssue[];
}

async function throwApiError(response: Response): Promise<never> {
  const body = (await response.json()) as ErrorBody;
  throw new QuizDraftApiError(
    body.message ?? 'Quiz request failed',
    response.status,
    body.issues ?? [],
  );
}

export async function fetchQuizDraft(id: number): Promise<QuizDraft> {
  const response = await fetch(`${getBackendUrl()}/quizzes/${id}`, {
    credentials: 'include',
  });
  if (!response.ok) return throwApiError(response);
  return (await response.json()) as QuizDraft;
}

export async function createQuiz(
  request: QuizDraftSaveRequest,
): Promise<QuizDraftSaveResult> {
  const response = await fetch(`${getBackendUrl()}/quizzes`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...CSRF_HEADERS,
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) return throwApiError(response);
  return (await response.json()) as QuizDraftSaveResult;
}

export async function updateQuiz(
  id: number,
  request: QuizDraftSaveRequest,
): Promise<QuizDraftSaveResult> {
  const response = await fetch(`${getBackendUrl()}/quizzes/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...CSRF_HEADERS,
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) return throwApiError(response);
  return (await response.json()) as QuizDraftSaveResult;
}
