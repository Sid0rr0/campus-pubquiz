import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createQuiz,
  fetchQuizDraft,
  QuizDraftApiError,
  updateQuiz,
} from '@/app/lib/quiz-draft-api';

const originalFetch = global.fetch;

describe('quiz-draft-api', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('fetchQuizDraft', () => {
    it('gets the draft with credentials', async () => {
      const draft = { id: 1, title: 'Trivia Night', rounds: [] };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(draft),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await fetchQuizDraft(1);

      expect(result).toEqual(draft);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/quizzes/1',
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('throws QuizDraftApiError with the server message on a non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: 'Quiz 1 does not exist' }),
      }) as unknown as typeof fetch;

      await expect(fetchQuizDraft(1)).rejects.toThrow('Quiz 1 does not exist');
    });
  });

  describe('createQuiz', () => {
    it('posts the draft with credentials and csrf headers', async () => {
      const result = { quizId: 1, roundCount: 1, questionCount: 2 };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(result),
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      const request = { title: 'Trivia Night', rounds: [] };

      const response = await createQuiz(request);

      expect(response).toEqual(result);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/quizzes',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          }) as Record<string, string>,
          body: JSON.stringify(request),
        }),
      );
    });

    it('attaches issues from a 422 response to the thrown error', async () => {
      const issues = [
        { roundIndex: 0, questionIndex: 0, field: 'prompt', message: 'Missing question text' },
      ];
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ message: 'Validation failed', issues }),
      }) as unknown as typeof fetch;

      const error = await createQuiz({ title: 'Trivia Night', rounds: [] }).catch(
        (e: unknown) => e,
      );

      expect(error).toBeInstanceOf(QuizDraftApiError);
      expect((error as QuizDraftApiError).issues).toEqual(issues);
    });
  });

  describe('updateQuiz', () => {
    it('puts the draft to /quizzes/:id', async () => {
      const result = { quizId: 5, roundCount: 1, questionCount: 2 };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(result),
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      const request = { title: 'Trivia Night 2', rounds: [] };

      const response = await updateQuiz(5, request);

      expect(response).toEqual(result);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/quizzes/5',
        expect.objectContaining({
          method: 'PUT',
          credentials: 'include',
          body: JSON.stringify(request),
        }),
      );
    });
  });
});
