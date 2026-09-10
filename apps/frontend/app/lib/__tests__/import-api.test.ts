import { afterEach, describe, expect, it, vi } from 'vitest';
import { previewImport, previewImportFromUrl } from '@/app/lib/import-api';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/abc123/edit';

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

  describe('previewImportFromUrl', () => {
    it('posts the sheet url with credentials and returns the preview', async () => {
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

      const result = await previewImportFromUrl(SHEET_URL, 'Trivia Night');

      expect(result).toEqual(preview);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/import/preview-from-url',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            sheetUrl: SHEET_URL,
            quizTitle: 'Trivia Night',
          }),
        }),
      );
    });

    it('throws ImportApiError with the server message on a fetch failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ message: 'Could not fetch that sheet' }),
      }) as unknown as typeof fetch;

      await expect(previewImportFromUrl(SHEET_URL, undefined)).rejects.toThrow(
        'Could not fetch that sheet',
      );
    });
  });
});
