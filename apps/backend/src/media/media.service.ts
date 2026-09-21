import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { MediaUploadResult } from '@campus-pubquiz/types';
import { detectImageType } from '@/media/detect-image-type';
import { MEDIA_STORAGE, type MediaStorage } from '@/media/media-storage';

const MEDIA_KEY_PREFIX = 'quiz-media';

export class UnsupportedImageError extends Error {
  constructor() {
    super('File is not a supported image (JPEG, PNG, GIF, WebP or AVIF)');
    this.name = 'UnsupportedImageError';
  }
}

@Injectable()
export class MediaService {
  constructor(@Inject(MEDIA_STORAGE) private readonly storage: MediaStorage) {}

  async uploadImage(data: Buffer): Promise<MediaUploadResult> {
    const detected = detectImageType(data);
    if (!detected) throw new UnsupportedImageError();

    // The uploader's filename is never used: a server-generated UUID key can't
    // path-traverse, collide, or be guessed (answer images must stay private
    // until reveal).
    const key = `${MEDIA_KEY_PREFIX}/${randomUUID()}.${detected.extension}`;
    const { url } = await this.storage.put({
      key,
      contentType: detected.contentType,
      data,
    });
    return { url };
  }
}
