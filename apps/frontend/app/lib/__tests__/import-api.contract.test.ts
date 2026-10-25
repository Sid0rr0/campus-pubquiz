import { expect, it, vi } from 'vitest';
import {
  BASE,
  CSRF,
  describeApiClient,
  JSON_TYPE,
} from '@/app/lib/__tests__/api-client-contract';
import {
  ImportApiError,
  previewImport,
  previewImportFromUrl,
} from '@/app/lib/import-api';

describeApiClient(
  'import-api',
  ImportApiError,
  'ImportApiError',
  [
    {
      name: 'previewImport',
      call: () => previewImport('a,b', 'Friday'),
      url: `${BASE}/import/preview`,
      init: {
        method: 'POST',
        credentials: 'include',
        headers: { ...JSON_TYPE, ...CSRF },
        body: JSON.stringify({ csvText: 'a,b', quizTitle: 'Friday' }),
      },
      fallback: 'Import request failed',
      okBody: { rounds: [] },
    },
    {
      name: 'previewImportFromUrl',
      call: () => previewImportFromUrl('https://sheet', 'Friday'),
      url: `${BASE}/import/preview-from-url`,
      init: {
        method: 'POST',
        credentials: 'include',
        headers: { ...JSON_TYPE, ...CSRF },
        body: JSON.stringify({
          sheetUrl: 'https://sheet',
          quizTitle: 'Friday',
        }),
      },
      fallback: 'Import request failed',
      okBody: { rounds: [] },
    },
  ],
  { toleratesBadJson: false },
);

it('defaults to no issues when the reply lists none', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 400,
    json: () => Promise.resolve({}),
  }) as unknown as typeof fetch;

  const error = await previewImport('a', undefined).catch((e: unknown) => e);

  expect((error as ImportApiError).issues).toEqual([]);
});

it('carries the row issues the server listed', async () => {
  const issues = [{ row: 2, message: 'bad' }];
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 400,
    json: () => Promise.resolve({ message: 'Invalid', issues }),
  }) as unknown as typeof fetch;

  const error = await previewImport('a', undefined).catch((e: unknown) => e);

  expect((error as ImportApiError).issues).toEqual(issues);
});
