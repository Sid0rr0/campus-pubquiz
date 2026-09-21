export interface MediaUpload {
  /** Storage path chosen by `MediaService` — drivers store the blob at exactly this key. */
  key: string;
  contentType: string;
  data: Buffer;
}

export interface StoredMedia {
  /** Public, direct URL of the stored blob. */
  url: string;
}

/**
 * The only seam between the app and wherever uploaded quiz images live.
 * Adding a provider (e.g. Cloudflare R2) means implementing this and adding a
 * case in `createMediaStorage` — nothing else in the app knows which one runs.
 */
export interface MediaStorage {
  put(upload: MediaUpload): Promise<StoredMedia>;
}

export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

/** The chosen provider is missing the credentials/config it needs to accept uploads. */
export class MediaStorageNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaStorageNotConfiguredError';
  }
}
