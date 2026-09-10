import type { ImportPreview, ImportRowIssue } from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';
import { CSRF_HEADERS } from '@/app/lib/csrf-headers';

export class ImportApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly issues: ImportRowIssue[] = [],
  ) {
    super(message);
    this.name = 'ImportApiError';
  }
}

interface ErrorBody {
  message?: string;
  issues?: ImportRowIssue[];
}

async function postImport<T>(
  path: 'preview' | 'preview-from-url',
  body: Record<string, string | undefined>,
): Promise<T> {
  const response = await fetch(`${getBackendUrl()}/import/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...CSRF_HEADERS,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = (await response.json()) as ErrorBody;
    throw new ImportApiError(
      errorBody.message ?? 'Import request failed',
      response.status,
      errorBody.issues ?? [],
    );
  }

  return (await response.json()) as T;
}

export function previewImport(
  csvText: string,
  quizTitle: string | undefined,
): Promise<ImportPreview> {
  return postImport<ImportPreview>('preview', { csvText, quizTitle });
}

export function previewImportFromUrl(
  sheetUrl: string,
  quizTitle: string | undefined,
): Promise<ImportPreview> {
  return postImport<ImportPreview>('preview-from-url', { sheetUrl, quizTitle });
}
