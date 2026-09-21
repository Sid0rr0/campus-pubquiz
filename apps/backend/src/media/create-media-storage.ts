import type { MediaStorage } from '@/media/media-storage';
import { VercelBlobMediaStorage } from '@/media/vercel-blob-media-storage';

const DEFAULT_PROVIDER = 'vercel-blob';

/**
 * Picks the storage driver from `MEDIA_STORAGE_PROVIDER`. To add a provider,
 * implement `MediaStorage` and add a case here.
 */
export function createMediaStorage(
  env: Record<string, string | undefined> = process.env,
): MediaStorage {
  const provider = env.MEDIA_STORAGE_PROVIDER || DEFAULT_PROVIDER;

  switch (provider) {
    case 'vercel-blob':
      return new VercelBlobMediaStorage(env.BLOB_READ_WRITE_TOKEN);
    default:
      throw new Error(
        `Unknown MEDIA_STORAGE_PROVIDER "${provider}" (supported: vercel-blob)`,
      );
  }
}
