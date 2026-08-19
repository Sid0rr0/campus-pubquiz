import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  confirmImport,
  ImportApiError,
  previewImport,
} from '@/app/lib/import-api';

const originalFetch = global.fetch;

describe('import-api', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('previewImport', () => {
    it('posts the csv text with credentials and returns the preview', async () => {
      const preview = {
        quizTitle: 'Trivia Night',
        rounds: [],
        issues: [],
        isImportable: true,
      };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(preview),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await previewImport('csv,text', 'Trivia Night');

      expect(result).toEqual(preview);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/import/preview',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }) as Record<string, string>,
          body: JSON.stringify({
            csvText: 'csv,text',
            quizTitle: 'Trivia Night',
          }),
        }),
      );
    });

    it('throws ImportApiError with the server message when the response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid or expired session' }),
      }) as unknown as typeof fetch;

      await expect(previewImport('csv', undefined)).rejects.toThrow(
        'Invalid or expired session',
      );
    });
  });

  describe('confirmImport', () => {
    it('posts to /import/confirm and returns the result', async () => {
      const result = { quizId: 'quiz-1', roundCount: 2, questionCount: 5 };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(result),
      }) as unknown as typeof fetch;

      const response = await confirmImport(
        'csv,text',
        'Trivia Night',
        'ABCDEF',
      );

      expect(response).toEqual(result);
    });

    it('attaches per-row issues from a 422 response to the thrown error', async () => {
      const issues = [
        { rowNumber: 2, field: 'answer', message: 'Missing answer' },
      ];
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ message: 'Validation failed', issues }),
      }) as unknown as typeof fetch;

      const error = await confirmImport('csv', undefined, 'ABCDEF').catch(
        (e: unknown) => e,
      );

      expect(error).toBeInstanceOf(ImportApiError);
      expect((error as ImportApiError).issues).toEqual(issues);
    });
  });
});
