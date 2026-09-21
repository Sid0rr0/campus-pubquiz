import { createMediaStorage } from '@/media/create-media-storage';
import { VercelBlobMediaStorage } from '@/media/vercel-blob-media-storage';

describe('createMediaStorage', () => {
  it('defaults to Vercel Blob when no provider is chosen', () => {
    const storage = createMediaStorage({ BLOB_READ_WRITE_TOKEN: 'token' });

    expect(storage).toBeInstanceOf(VercelBlobMediaStorage);
  });

  it('builds Vercel Blob when explicitly selected', () => {
    const storage = createMediaStorage({
      MEDIA_STORAGE_PROVIDER: 'vercel-blob',
      BLOB_READ_WRITE_TOKEN: 'token',
    });

    expect(storage).toBeInstanceOf(VercelBlobMediaStorage);
  });

  it('still boots without a token, so dev machines need no Blob store', () => {
    expect(() => createMediaStorage({})).not.toThrow();
  });

  it('fails fast at startup on an unknown provider name', () => {
    expect(() => createMediaStorage({ MEDIA_STORAGE_PROVIDER: 'r3' })).toThrow(
      /Unknown MEDIA_STORAGE_PROVIDER "r3".*vercel-blob/,
    );
  });
});
