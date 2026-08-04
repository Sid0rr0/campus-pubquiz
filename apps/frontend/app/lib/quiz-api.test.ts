import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchQuizzes, QuizApiError } from '@/app/lib/quiz-api';

const originalFetch = global.fetch;

describe('quiz-api', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('fetchQuizzes', () => {
    it('gets /quizzes with the admin password header and returns the payload', async () => {
      const payload = {
        activeQuizId: 1,
        quizzes: [{ id: 1, title: 'Campus Pub Quiz Night', rounds: [] }],
      };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await fetchQuizzes('secret');

      expect(result).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/quizzes',
        expect.objectContaining({
          headers: expect.objectContaining({ 'x-admin-password': 'secret' }) as Record<
            string,
            string
          >,
        }),
      );
    });

    it('throws QuizApiError with the server message when the response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid admin password' }),
      }) as unknown as typeof fetch;

      const error = await fetchQuizzes('wrong').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(QuizApiError);
      expect((error as QuizApiError).message).toBe('Invalid admin password');
      expect((error as QuizApiError).status).toBe(401);
    });
  });
});
