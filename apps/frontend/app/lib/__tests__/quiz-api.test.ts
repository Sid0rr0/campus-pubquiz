import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteQuiz, fetchQuizzes, QuizApiError } from '@/app/lib/quiz-api';

const originalFetch = global.fetch;

describe('quiz-api', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('fetchQuizzes', () => {
    it('gets /quizzes with the session cookie and returns the payload', async () => {
      const payload = {
        activeQuizId: 1,
        quizzes: [{ id: 1, title: 'Campus Pub Quiz Night', rounds: [] }],
      };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await fetchQuizzes();

      expect(result).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/quizzes',
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('throws QuizApiError with the server message when the response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid or expired session' }),
      }) as unknown as typeof fetch;

      const error = await fetchQuizzes().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(QuizApiError);
      expect((error as QuizApiError).message).toBe(
        'Invalid or expired session',
      );
      expect((error as QuizApiError).status).toBe(401);
    });
  });

  describe('deleteQuiz', () => {
    it('sends a DELETE to /quizzes/:id with the session cookie', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = fetchMock as unknown as typeof fetch;

      await deleteQuiz(2);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/quizzes/2',
        expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
      );
    });

    it('throws QuizApiError with the server message when the response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () =>
          Promise.resolve({
            message:
              'Cannot delete a quiz with a live session running — close the session first',
          }),
      }) as unknown as typeof fetch;

      const error = await deleteQuiz(2).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(QuizApiError);
      expect((error as QuizApiError).status).toBe(409);
    });
  });
});
