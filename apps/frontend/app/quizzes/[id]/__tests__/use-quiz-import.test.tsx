import { type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ImportPreview } from '@campus-pubquiz/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportApiError } from '@/app/lib/import-api';
import {
  makeRound,
  type EditorRound,
} from '@/app/quizzes/[id]/quiz-draft-state';
import { useQuizImport } from '@/app/quizzes/[id]/use-quiz-import';

const { mockPreviewImport, mockPreviewImportFromUrl, mockToast } = vi.hoisted(
  () => ({
    mockPreviewImport: vi.fn(),
    mockPreviewImportFromUrl: vi.fn(),
    mockToast: { success: vi.fn(), error: vi.fn() },
  }),
);

vi.mock('sonner', () => ({ toast: mockToast }));
vi.mock('@/app/lib/import-api', async () => {
  const actual = await vi.importActual<typeof import('@/app/lib/import-api')>(
    '@/app/lib/import-api',
  );
  return {
    ...actual,
    previewImport: mockPreviewImport,
    previewImportFromUrl: mockPreviewImportFromUrl,
  };
});

const preview = (overrides: Partial<ImportPreview> = {}): ImportPreview => ({
  quizTitle: 'From file',
  rounds: [
    {
      title: 'A',
      breakAfter: false,
      questions: [{ type: 'free_text', prompt: 'Q', answer: 'a', points: 1 }],
    },
  ],
  issues: [],
  isImportable: true,
  ...overrides,
});

const existing: EditorRound[] = [makeRound('old', 'Old')];

function renderImport(
  options: {
    rounds?: EditorRound[];
    title?: string;
    isEditorShowing?: boolean;
  } = {},
) {
  const onApply = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    () =>
      useQuizImport({
        rounds: options.rounds ?? existing,
        title: options.title ?? '',
        isEditorShowing: options.isEditorShowing ?? true,
        onApply,
      }),
    { wrapper },
  );
  return { ...view, onApply };
}

function csvEvent(file: File | undefined) {
  const target = { files: file ? [file] : [], value: 'C:\\fakepath\\x.csv' };
  return {
    event: { target } as unknown as ChangeEvent<HTMLInputElement>,
    target,
  };
}

const csvFile = (name = 'quiz.csv') =>
  new File(['round,type\n'], name, { type: 'text/csv' });

function formEvent() {
  const preventDefault = vi.fn();
  return {
    event: { preventDefault } as unknown as FormEvent<HTMLFormElement>,
    preventDefault,
  };
}

beforeEach(() => {
  for (const mock of [
    mockPreviewImport,
    mockPreviewImportFromUrl,
    mockToast.success,
    mockToast.error,
  ]) {
    mock.mockReset();
  }
});

describe('importing a CSV file', () => {
  it('previews the file under its name, applies the outcome and toasts the summary', async () => {
    mockPreviewImport.mockResolvedValue(preview());
    const { result, onApply } = renderImport();
    const { event, target } = csvEvent(csvFile('Pub Night.csv'));

    await act(() => result.current.handleCsvFile(event));

    expect(target.value).toBe('');
    expect(mockPreviewImport).toHaveBeenCalledWith('round,type\n', 'Pub Night');
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    expect(
      onApply.mock.calls[0][0].rounds.map((r: EditorRound) => r.title),
    ).toEqual(['A']);
    expect(mockToast.success).toHaveBeenCalledWith(
      'Imported 1 round and 1 question — review and edit below.',
    );
    expect(result.current.importError).toBeNull();
  });

  it('does nothing when no file was chosen', async () => {
    const { result, onApply } = renderImport();

    await act(() => result.current.handleCsvFile(csvEvent(undefined).event));

    expect(mockPreviewImport).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('shows the issues instead of a toast when the preview lists some', async () => {
    mockPreviewImport.mockResolvedValue(
      preview({
        issues: [{ rowNumber: 2, field: 'answer', message: 'missing' }],
      }),
    );
    const { result, onApply } = renderImport();

    await act(() => result.current.handleCsvFile(csvEvent(csvFile()).event));

    await waitFor(() =>
      expect(result.current.importError).toBe(
        'Imported with 1 issue(s) to fix before saving — row 2 (answer): missing',
      ),
    );
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it('clears the previous error as soon as another file is picked', async () => {
    mockPreviewImport.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderImport();
    await act(() => result.current.handleCsvFile(csvEvent(csvFile()).event));
    await waitFor(() => expect(result.current.importError).not.toBeNull());
    mockPreviewImport.mockReturnValueOnce(new Promise(() => undefined));

    await act(() => result.current.handleCsvFile(csvEvent(csvFile()).event));

    expect(result.current.importError).toBeNull();
  });

  it('falls back to a generic message when the preview fails for another reason than the API', async () => {
    mockPreviewImport.mockRejectedValue(new Error('network down'));
    const { result } = renderImport();

    await act(() => result.current.handleCsvFile(csvEvent(csvFile()).event));

    await waitFor(() =>
      expect(result.current.importError).toBe('Could not read that CSV.'),
    );
  });

  it('shows the API’s own message when it rejects the file', async () => {
    mockPreviewImport.mockRejectedValue(new ImportApiError('Bad header', 400));
    const { result } = renderImport();

    await act(() => result.current.handleCsvFile(csvEvent(csvFile()).event));

    await waitFor(() => expect(result.current.importError).toBe('Bad header'));
  });
});

describe('adding to the quiz instead of replacing it', () => {
  async function importedRoundTitles(
    appendImport: boolean,
    isEditorShowing: boolean,
  ) {
    mockPreviewImport.mockResolvedValue(preview());
    const { result, onApply } = renderImport({ isEditorShowing });
    act(() => result.current.setAppendImport(appendImport));

    await act(() => result.current.handleCsvFile(csvEvent(csvFile()).event));

    await waitFor(() => expect(onApply).toHaveBeenCalled());
    return onApply.mock.calls[0][0].rounds.map((r: EditorRound) => r.title);
  }

  it('adds when "add to quiz" is checked and the editor is showing', async () => {
    expect(await importedRoundTitles(true, true)).toEqual(['Old', 'A']);
  });

  it('replaces when "add to quiz" is not checked', async () => {
    expect(await importedRoundTitles(false, true)).toEqual(['A']);
  });

  it('replaces when the editor is not showing yet, even if "add to quiz" is checked', async () => {
    expect(await importedRoundTitles(true, false)).toEqual(['A']);
  });
});

describe('importing a Google Sheet', () => {
  it('previews the trimmed link under the trimmed title, and keeps the form from reloading the page', async () => {
    mockPreviewImportFromUrl.mockResolvedValue(preview());
    const { result, onApply } = renderImport({ title: ' Mine ' });
    act(() => result.current.setSheetUrlInput('  https://sheet/1  '));
    const { event, preventDefault } = formEvent();

    act(() => result.current.handleSheetUrlSubmit(event));

    expect(preventDefault).toHaveBeenCalled();
    await waitFor(() =>
      expect(mockPreviewImportFromUrl).toHaveBeenCalledWith(
        'https://sheet/1',
        'Mine',
      ),
    );
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
  });

  it('sends no title when the current one is only whitespace', async () => {
    mockPreviewImportFromUrl.mockResolvedValue(preview());
    const { result } = renderImport({ title: '   ' });
    act(() => result.current.setSheetUrlInput('https://sheet/1'));

    act(() => result.current.handleSheetUrlSubmit(formEvent().event));

    await waitFor(() =>
      expect(mockPreviewImportFromUrl).toHaveBeenCalledWith(
        'https://sheet/1',
        undefined,
      ),
    );
  });

  it('ignores a blank link, leaving any earlier error showing', async () => {
    mockPreviewImport.mockRejectedValue(new Error('boom'));
    const { result } = renderImport();
    await act(() => result.current.handleCsvFile(csvEvent(csvFile()).event));
    await waitFor(() => expect(result.current.importError).not.toBeNull());
    act(() => result.current.setSheetUrlInput('   '));
    const { event, preventDefault } = formEvent();

    act(() => result.current.handleSheetUrlSubmit(event));

    expect(preventDefault).toHaveBeenCalled();
    expect(mockPreviewImportFromUrl).not.toHaveBeenCalled();
    expect(result.current.importError).not.toBeNull();
  });

  it('clears the previous error as soon as a link is submitted', async () => {
    mockPreviewImport.mockRejectedValue(new Error('boom'));
    const { result } = renderImport();
    await act(() => result.current.handleCsvFile(csvEvent(csvFile()).event));
    await waitFor(() => expect(result.current.importError).not.toBeNull());
    mockPreviewImportFromUrl.mockReturnValue(new Promise(() => undefined));
    act(() => result.current.setSheetUrlInput('https://sheet/1'));

    act(() => result.current.handleSheetUrlSubmit(formEvent().event));

    expect(result.current.importError).toBeNull();
    await waitFor(() => expect(result.current.isSheetPending).toBe(true));
  });

  it('falls back to a generic message when the sheet cannot be fetched', async () => {
    mockPreviewImportFromUrl.mockRejectedValue(new Error('network down'));
    const { result } = renderImport();
    act(() => result.current.setSheetUrlInput('https://sheet/1'));

    act(() => result.current.handleSheetUrlSubmit(formEvent().event));

    await waitFor(() =>
      expect(result.current.importError).toBe(
        'Could not fetch that Google Sheet.',
      ),
    );
  });
});
