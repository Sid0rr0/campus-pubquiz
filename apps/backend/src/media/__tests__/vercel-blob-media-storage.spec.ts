import { put } from '@vercel/blob';
import { MediaStorageNotConfiguredError } from '@/media/media-storage';
import { VercelBlobMediaStorage } from '@/media/vercel-blob-media-storage';

jest.mock('@vercel/blob', () => ({ put: jest.fn() }));

const mockPut = jest.mocked(put);

const UPLOAD = {
  key: 'quiz-media/abc.png',
  contentType: 'image/png',
  data: Buffer.from([1, 2, 3]),
};

describe('VercelBlobMediaStorage', () => {
  beforeEach(() => {
    mockPut.mockReset();
  });

  it('uploads a public blob at the exact key and returns its URL', async () => {
    mockPut.mockResolvedValue({
      url: 'https://store.public.blob.vercel-storage.com/quiz-media/abc.png',
    } as Awaited<ReturnType<typeof put>>);
    const storage = new VercelBlobMediaStorage('vercel_blob_rw_token');

    const result = await storage.put(UPLOAD);

    expect(result).toEqual({
      url: 'https://store.public.blob.vercel-storage.com/quiz-media/abc.png',
    });
    expect(mockPut).toHaveBeenCalledWith('quiz-media/abc.png', UPLOAD.data, {
      access: 'public',
      contentType: 'image/png',
      token: 'vercel_blob_rw_token',
      addRandomSuffix: false,
      allowOverwrite: false,
    });
  });

  it('throws MediaStorageNotConfiguredError when no token is set, without calling Vercel', async () => {
    const storage = new VercelBlobMediaStorage(undefined);

    await expect(storage.put(UPLOAD)).rejects.toBeInstanceOf(
      MediaStorageNotConfiguredError,
    );
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('treats an empty token the same as a missing one', async () => {
    const storage = new VercelBlobMediaStorage('');

    await expect(storage.put(UPLOAD)).rejects.toBeInstanceOf(
      MediaStorageNotConfiguredError,
    );
  });
});
