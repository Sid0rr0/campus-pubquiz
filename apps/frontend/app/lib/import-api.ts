import type {
  ImportConfirmResult,
  ImportPreview,
  ImportRowIssue,
} from '@campus-pubquiz/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

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
  adminPassword: string,
): Promise<T> {
  const response = await fetch(`${BACKEND_URL}/import/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': adminPassword,
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
  adminPassword: string,
): Promise<ImportPreview> {
  return postImport<ImportPreview>('preview', csvText, quizTitle, adminPassword);
}

export function confirmImport(
  csvText: string,
  quizTitle: string | undefined,
  adminPassword: string,
): Promise<ImportConfirmResult> {
  return postImport<ImportConfirmResult>('confirm', csvText, quizTitle, adminPassword);
}
