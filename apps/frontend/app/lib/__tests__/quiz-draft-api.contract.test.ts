import { expect, it, vi } from 'vitest';
import {
  BASE,
  CSRF,
  describeApiClient,
  JSON_TYPE,
} from '@/app/lib/__tests__/api-client-contract';
import {
  createQuiz,
  fetchQuizDraft,
  QuizDraftApiError,
  updateQuiz,
} from '@/app/lib/quiz-draft-api';

const request = { title: 'Friday', rounds: [] };

describeApiClient(
  'quiz-draft-api',
  QuizDraftApiError,
  'QuizDraftApiError',
  [
    {
      name: 'fetchQuizDraft',
      call: () => fetchQuizDraft(6),
      url: `${BASE}/quizzes/6`,
      init: { credentials: 'include' },
      fallback: 'Quiz request failed',
      okBody: { title: 'Friday' },
    },
    {
      name: 'createQuiz',
      call: () => createQuiz(request),
      url: `${BASE}/quizzes`,
      init: {
        method: 'POST',
        credentials: 'include',
        headers: { ...JSON_TYPE, ...CSRF },
        body: JSON.stringify(request),
      },
      fallback: 'Quiz request failed',
      okBody: { quizId: 6 },
    },
    {
      name: 'updateQuiz',
      call: () => updateQuiz(6, request),
      url: `${BASE}/quizzes/6`,
      init: {
        method: 'PUT',
        credentials: 'include',
        headers: { ...JSON_TYPE, ...CSRF },
        body: JSON.stringify(request),
      },
      fallback: 'Quiz request failed',
      okBody: { quizId: 6 },
    },
  ],
  { toleratesBadJson: false },
);

it('defaults to no issues when the reply lists none', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 400,
    json: () => Promise.resolve({}),
  }) as unknown as typeof fetch;

  const error = await fetchQuizDraft(6).catch((e: unknown) => e);

  expect((error as QuizDraftApiError).issues).toEqual([]);
});

it('carries the issues the server listed', async () => {
  const issues = [{ row: 2, message: 'bad' }];
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 400,
    json: () => Promise.resolve({ message: 'Invalid', issues }),
  }) as unknown as typeof fetch;

  const error = await createQuiz(request).catch((e: unknown) => e);

  expect((error as QuizDraftApiError).issues).toEqual(issues);
});
