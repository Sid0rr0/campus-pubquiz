import type { MediaUploadResult } from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';
import { CSRF_HEADERS } from '@/app/lib/csrf-headers';

const UPLOAD_FAILED_MESSAGE = 'Image upload failed';

export class MediaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'MediaApiError';
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === 'string'
      ? body.message
      : UPLOAD_FAILED_MESSAGE;
  } catch {
    // A proxy or platform error page isn't JSON — nothing better to show.
    return UPLOAD_FAILED_MESSAGE;
  }
}

export async function uploadMedia(file: File): Promise<MediaUploadResult> {
  const body = new FormData();
  body.append('file', file);

  const response = await fetch(`${getBackendUrl()}/media`, {
    method: 'POST',
    credentials: 'include',
    // No Content-Type: the browser must set it to add the multipart boundary.
    headers: { ...CSRF_HEADERS },
    body,
  });

  if (!response.ok) {
    throw new MediaApiError(await readErrorMessage(response), response.status);
  }

  return (await response.json()) as MediaUploadResult;
}
