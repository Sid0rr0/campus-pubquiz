import { put } from '@vercel/blob';
import {
  MediaStorageNotConfiguredError,
  type MediaStorage,
  type MediaUpload,
  type StoredMedia,
} from '@/media/media-storage';

export class VercelBlobMediaStorage implements MediaStorage {
  constructor(private readonly token: string | undefined) {}

  async put({ key, contentType, data }: MediaUpload): Promise<StoredMedia> {
    if (!this.token) {
      throw new MediaStorageNotConfiguredError(
        'BLOB_READ_WRITE_TOKEN is not set',
      );
    }
    const blob = await put(key, data, {
      access: 'public',
      contentType,
      token: this.token,
      // The key already carries a UUID, so a suffix would only add noise.
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return { url: blob.url };
  }
}
