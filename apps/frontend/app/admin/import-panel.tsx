'use client';

import { useState, type ChangeEvent } from 'react';
import type { ImportConfirmResult, ImportPreview } from '@campus-pubquiz/types';
import { confirmImport, previewImport } from '@/app/lib/import-api';
import { RoundsList } from '@/app/components/rounds-list';

interface ImportPanelProps {
  joinCode: string;
  onImported?: (result: ImportConfirmResult) => void;
}

export function ImportPanel({ joinCode, onImported }: ImportPanelProps) {
  const [quizTitle, setQuizTitle] = useState('');
  const [csvText, setCsvText] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setPreview(null);
    const text = await file.text();
    setCsvText(text);

    try {
      const result = await previewImport(text, quizTitle || undefined);
      setPreview(result);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Could not read the file');
    }
  }

  async function handleConfirm() {
    if (!csvText) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await confirmImport(csvText, quizTitle || undefined, joinCode);
      setPreview(null);
      setCsvText(null);
      onImported?.(result);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'Import failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-foreground/15 bg-white p-4">
      <h2 className="font-display text-xl">Import Quiz from CSV</h2>
      {error && (
        <p role="alert" className="font-extrabold text-magenta">
          {error}
        </p>
      )}
      <label htmlFor="import-quiz-title" className="text-xs font-extrabold tracking-wide text-foreground/55">
        Quiz title (optional)
      </label>
      <input
        id="import-quiz-title"
        value={quizTitle}
        onChange={(event) => setQuizTitle(event.target.value)}
        className="min-h-11 rounded-lg border-2 border-foreground/35 px-3 text-sm font-bold"
      />
      <label htmlFor="import-csv-file" className="text-xs font-extrabold tracking-wide text-foreground/55">
        Quiz CSV file
      </label>
      <input
        id="import-csv-file"
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => void handleFileChange(event)}
        className="text-sm"
      />
      {preview && <RoundsList rounds={preview.rounds} />}
      {preview && preview.issues.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg border border-magenta/40 bg-magenta/5 p-3 text-sm">
          {preview.issues.map((issue, index) => (
            <li key={`${issue.rowNumber}-${issue.field}-${index}`}>
              Row {issue.rowNumber} ({issue.field}): {issue.message}
            </li>
          ))}
        </ul>
      )}
      {preview && (
        <button
          type="button"
          disabled={!preview.isImportable || isSubmitting}
          onClick={() => void handleConfirm()}
          className="min-h-11 rounded-lg bg-magenta text-sm font-extrabold text-white disabled:opacity-40"
        >
          Confirm Import
        </button>
      )}
    </section>
  );
}
