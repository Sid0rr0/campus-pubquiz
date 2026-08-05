import type {
  ImportConfirmResult,
  ImportPreview,
  ImportRowIssue,
} from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';

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
  path: 'preview' | 'confirm',
  csvText: string,
  quizTitle: string | undefined,
): Promise<T> {
  const response = await fetch(`${getBackendUrl()}/import/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ csvText, quizTitle }),
  });

  if (!response.ok) {
    const body = (await response.json()) as ErrorBody;
    throw new ImportApiError(
      body.message ?? 'Import request failed',
      response.status,
      body.issues ?? [],
    );
  }

  return (await response.json()) as T;
}

export function previewImport(
  csvText: string,
  quizTitle: string | undefined,
): Promise<ImportPreview> {
  return postImport<ImportPreview>('preview', csvText, quizTitle);
}

export function confirmImport(
  csvText: string,
  quizTitle: string | undefined,
): Promise<ImportConfirmResult> {
  return postImport<ImportConfirmResult>('confirm', csvText, quizTitle);
}
