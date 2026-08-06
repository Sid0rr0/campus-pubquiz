import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnswerApiError, fetchAnswers } from '@/app/lib/answer-api';

const originalFetch = global.fetch;

describe('answer-api', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('fetchAnswers', () => {
    it('gets /sessions/:joinCode/answers/:questionId with the session cookie and returns the payload', async () => {
      const payload = {
        questionId: 21,
        question: {
          type: 'free_text',
          prompt: 'Q1',
          points: 1,
          correctAnswer: 'A1',
          roundTitle: 'Round 1',
          roundNumber: 1,
          questionNumberInRound: 1,
          totalQuestionsInRound: 1,
        },
        answers: [],
      };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await fetchAnswers('ABCDEF', 21);

      expect(result).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/sessions/ABCDEF/answers/21',
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('throws AnswerApiError with the server message when the response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: 'Unknown question 21' }),
      }) as unknown as typeof fetch;

      const error = await fetchAnswers('ABCDEF', 21).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AnswerApiError);
      expect((error as AnswerApiError).message).toBe('Unknown question 21');
      expect((error as AnswerApiError).status).toBe(404);
    });
  });
});
