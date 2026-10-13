import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ImportPreview } from '@campus-pubquiz/types';
import {
  ImportApiError,
  previewImport,
  previewImportFromUrl,
} from '@/app/lib/import-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import {
  csvImportTitle,
  importOutcome,
  type ImportOutcome,
  type EditorRound,
} from '@/app/quizzes/[id]/quiz-draft-state';

interface UseQuizImportOptions {
  rounds: EditorRound[];
  title: string;
  /** Whether the editor (not the empty state) is showing — "add to quiz" only applies there. */
  isEditorShowing: boolean;
  /** Applies an import's new rounds and title to the draft. */
  onApply: (outcome: ImportOutcome) => void;
}

export interface QuizImport {
  handleCsvFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleSheetUrlSubmit: (event: FormEvent<HTMLFormElement>) => void;
  sheetUrlInput: string;
  setSheetUrlInput: (value: string) => void;
  appendImport: boolean;
  setAppendImport: (value: boolean) => void;
  isSheetPending: boolean;
  importError: string | null;
}

/** The CSV and Google Sheets import: reads the file or link, applies the outcome through `onApply` and toasts the summary. */
export function useQuizImport({
  rounds,
  title,
  isEditorShowing,
  onApply,
}: UseQuizImportOptions): QuizImport {
  const [importError, setImportError] = useState<string | null>(null);
  const [sheetUrlInput, setSheetUrlInput] = useState('');
  const [appendImport, setAppendImport] = useState(false);

  function handleImportPreview(preview: ImportPreview): void {
    const outcome = importOutcome({
      rounds,
      title,
      preview,
      shouldAdd: appendImport && isEditorShowing,
      makeId: () => crypto.randomUUID(),
    });
    onApply(outcome);
    if (outcome.result.kind === 'issues') {
      setImportError(outcome.result.message);
    } else {
      toast.success(outcome.result.message);
    }
  }

  function handleImportError(error: unknown, fallback: string): void {
    setImportError(
      apiErrorMessage(error, ImportApiError, fallback) ?? fallback,
    );
  }

  const previewMutation = useMutation({
    mutationFn: ({ csvText, title }: { csvText: string; title: string }) =>
      previewImport(csvText, title || undefined),
    onSuccess: handleImportPreview,
    onError: (error) => handleImportError(error, 'Could not read that CSV.'),
  });

  const previewFromUrlMutation = useMutation({
    mutationFn: (sheetUrl: string) =>
      previewImportFromUrl(sheetUrl, title.trim() || undefined),
    onSuccess: handleImportPreview,
    onError: (error) =>
      handleImportError(error, 'Could not fetch that Google Sheet.'),
  });

  async function handleCsvFile(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportError(null);
    const text = await file.text();
    previewMutation.mutate({
      csvText: text,
      title: csvImportTitle(title, file.name),
    });
  }

  function handleSheetUrlSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const sheetUrl = sheetUrlInput.trim();
    if (!sheetUrl) return;

    setImportError(null);
    previewFromUrlMutation.mutate(sheetUrl);
  }

  return {
    handleCsvFile,
    handleSheetUrlSubmit,
    sheetUrlInput,
    setSheetUrlInput,
    appendImport,
    setAppendImport,
    isSheetPending: previewFromUrlMutation.isPending,
    importError,
  };
}
