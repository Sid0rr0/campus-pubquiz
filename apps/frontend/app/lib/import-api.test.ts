import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmImport, ImportApiError, previewImport } from '@/app/lib/import-api';

const originalFetch = global.fetch;

describe('import-api', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'http://backend.test');
  });

  describe('previewImport', () => {
    it('posts the csv text and admin password header and returns the preview', async () => {
      const preview = { quizTitle: 'Trivia Night', rounds: [], issues: [], isImportable: true };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(preview),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await previewImport('csv,text', 'Trivia Night', 'secret');

      expect(result).toEqual(preview);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://backend.test/import/preview',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-admin-password': 'secret',
            'Content-Type': 'application/json',
          }) as Record<string, string>,
          body: JSON.stringify({ csvText: 'csv,text', quizTitle: 'Trivia Night' }),
        }),
      );
    });

    it('throws ImportApiError with the server message when the response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid admin password' }),
      }) as unknown as typeof fetch;

      await expect(previewImport('csv', undefined, 'wrong')).rejects.toThrow(
        'Invalid admin password',
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

      const response = await confirmImport('csv,text', 'Trivia Night', 'secret');

      expect(response).toEqual(result);
    });

    it('attaches per-row issues from a 422 response to the thrown error', async () => {
      const issues = [{ rowNumber: 2, field: 'answer', message: 'Missing answer' }];
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ message: 'Validation failed', issues }),
      }) as unknown as typeof fetch;

      const error = await confirmImport('csv', undefined, 'secret').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ImportApiError);
      expect((error as ImportApiError).issues).toEqual(issues);
    });
  });
});
