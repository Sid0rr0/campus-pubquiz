import { vi } from 'vitest';

// Factory for `vi.mock('@/app/lib/answer-api', ...)` in /control specs that
// don't care about graded answers: the page loads the open question's answers
// for grading, and without this that fetch would hit the network (which the
// unmocked-fetch guard turns into a failure). `fetchAnswers` resolves `null`.
//
//   vi.mock('@/app/lib/answer-api', async () =>
//     (await import('@/test-utils/answer-api-offline')).createOfflineAnswerApi(),
//   );
export async function createOfflineAnswerApi() {
  const actual = await vi.importActual<typeof import('@/app/lib/answer-api')>(
    '@/app/lib/answer-api',
  );
  return { ...actual, fetchAnswers: vi.fn().mockResolvedValue(null) };
}
