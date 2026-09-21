import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaApiError, uploadMedia } from '@/app/lib/media-api';

const originalFetch = global.fetch;

function makeFile(): File {
  return new File([new Uint8Array([1, 2, 3])], 'photo.png', {
    type: 'image/png',
  });
}

describe('media-api', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('uploadMedia', () => {
    it('posts the file as multipart form data with credentials and returns the url', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: 'https://cdn.example/a.png' }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      const file = makeFile();

      const result = await uploadMedia(file);

      expect(result).toEqual({ url: 'https://cdn.example/a.png' });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/media');
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('include');
      expect(init.headers).toEqual({ 'X-Requested-With': 'XMLHttpRequest' });
      expect((init.body as FormData).get('file')).toBe(file);
    });

    it('leaves Content-Type unset so the browser adds the multipart boundary', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: 'https://cdn.example/a.png' }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      await uploadMedia(makeFile());

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.headers).not.toHaveProperty('Content-Type');
    });

    it('throws MediaApiError with the server message when the response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 415,
        json: () =>
          Promise.resolve({ message: 'File is not a supported image' }),
      }) as unknown as typeof fetch;

      const error = await uploadMedia(makeFile()).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(MediaApiError);
      expect((error as MediaApiError).message).toBe(
        'File is not a supported image',
      );
      expect((error as MediaApiError).status).toBe(415);
    });

    it('falls back to a generic message when the error body is not JSON', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new SyntaxError('Unexpected token <')),
      }) as unknown as typeof fetch;

      await expect(uploadMedia(makeFile())).rejects.toThrow(
        'Image upload failed',
      );
    });
  });
});
