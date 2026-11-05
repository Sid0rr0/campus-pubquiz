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

const REPLACE_PROMPT =
  'Importing replaces every round and question in the editor, including unsaved changes. Replace them?';

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

  // Replacing (not adding) throws away every question in the draft, so ask first.
  function isReplaceDeclined(): boolean {
    return (
      wouldReplaceQuestions(rounds, isEditorShowing && !appendImport) &&
      !window.confirm(REPLACE_PROMPT)
    );
  }

  function handleImportPreview(preview: ImportPreview): void {
    const outcome = importOutcome({
      rounds,
      title,
      preview,
      shouldAdd: appendImport && isEditorShowing,
      makeId: () => crypto.randomUUID(),
    });
    onApply(outcome);
    reportImportResult(outcome.result, setImportError);
  }

  function handleImportError(error: unknown, fallback: string): void {
    setImportError(importErrorMessage(error, fallback));
  }

  const previewMutation = useMutation({
    mutationFn: ({ csvText, title }: { csvText: string; title: string }) =>
      previewImport(csvText, blankToUndefined(title)),
    onSuccess: handleImportPreview,
    onError: (error) => handleImportError(error, 'Could not read that CSV.'),
  });

  const previewFromUrlMutation = useMutation({
    mutationFn: (sheetUrl: string) =>
      previewImportFromUrl(sheetUrl, blankToUndefined(title.trim())),
    onSuccess: handleImportPreview,
    onError: (error) =>
      handleImportError(error, 'Could not fetch that Google Sheet.'),
  });

  async function handleCsvFile(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isReplaceDeclined()) return;

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
    if (!sheetUrl || isReplaceDeclined()) return;

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

function wouldReplaceQuestions(
  rounds: UseQuizImportOptions['rounds'],
  isReplacing: boolean,
): boolean {
  return isReplacing && rounds.some((round) => round.questions.length > 0);
}

/** Issues stay on the page until the next import; a clean import is toasted. */
function reportImportResult(
  result: ReturnType<typeof importOutcome>['result'],
  setImportError: (message: string) => void,
): void {
  if (result.kind === 'issues') {
    setImportError(result.message);
  } else {
    toast.success(result.message);
  }
}

function blankToUndefined(text: string): string | undefined {
  return text || undefined;
}

function importErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, ImportApiError, fallback) ?? fallback;
}
