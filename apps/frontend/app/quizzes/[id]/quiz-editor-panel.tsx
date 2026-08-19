'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  CheckIcon,
  FilePlusIcon,
  PlusIcon,
  UploadIcon,
} from '@radix-ui/react-icons';
import type { QuizDraftIssue } from '@campus-pubquiz/types';
import { ImportApiError, previewImport } from '@/app/lib/import-api';
import {
  createQuiz,
  fetchQuizDraft,
  QuizDraftApiError,
  updateQuiz,
} from '@/app/lib/quiz-draft-api';
import {
  makeRound,
  roundFromPreview,
  toSaveRequest,
  type EditorRound,
} from '@/app/quizzes/[id]/quiz-draft-state';
import { QuizRoundEditor } from '@/app/quizzes/[id]/quiz-round-editor';

interface QuizEditorPanelProps {
  quizId: string;
}

type Phase = 'loading' | 'empty' | 'error' | 'editor';

function issueLabel(issue: QuizDraftIssue): string {
  if (issue.roundIndex === -1) return `Quiz (${issue.field}): ${issue.message}`;
  const questionLabel =
    issue.questionIndex !== null ? `, Q${issue.questionIndex + 1}` : '';
  return `Round ${issue.roundIndex + 1}${questionLabel} (${issue.field}): ${issue.message}`;
}

export function QuizEditorPanel({ quizId }: QuizEditorPanelProps) {
  const router = useRouter();
  const initialQuizIdRef = useRef(quizId);
  const [phase, setPhase] = useState<Phase>(
    quizId === 'new' ? 'empty' : 'loading',
  );
  const [quizTitle, setQuizTitle] = useState('');
  const [rounds, setRounds] = useState<EditorRound[]>([]);
  const [savedQuizId, setSavedQuizId] = useState<number | null>(
    quizId === 'new' ? null : Number(quizId),
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveIssues, setSaveIssues] = useState<QuizDraftIssue[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (initialQuizIdRef.current === 'new') return;
    fetchQuizDraft(Number(initialQuizIdRef.current))
      .then((draft) => {
        setQuizTitle(draft.title);
        setRounds(
          draft.rounds.map((round) =>
            roundFromPreview(crypto.randomUUID(), round, () =>
              crypto.randomUUID(),
            ),
          ),
        );
        setPhase('editor');
      })
      .catch((error: unknown) => {
        setLoadError(
          error instanceof QuizDraftApiError
            ? error.message
            : 'Could not load that quiz.',
        );
        setPhase('error');
      });
  }, []);

  function startFromScratch(): void {
    setRounds([makeRound(crypto.randomUUID(), 'Round 1')]);
    setPhase('editor');
  }

  async function handleCsvFile(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportError(null);
    const text = await file.text();

    try {
      const preview = await previewImport(text, quizTitle.trim() || undefined);
      const newRounds = preview.rounds.map((round) =>
        roundFromPreview(crypto.randomUUID(), round, () => crypto.randomUUID()),
      );
      setRounds(newRounds);
      if (!quizTitle.trim()) setQuizTitle(preview.quizTitle);
      setPhase('editor');

      const questionCount = newRounds.reduce(
        (total, round) => total + round.questions.length,
        0,
      );
      if (preview.issues.length > 0) {
        setImportError(
          `Imported with ${preview.issues.length} issue(s) to fix before saving — ` +
            preview.issues
              .map(
                (issue) =>
                  `row ${issue.rowNumber} (${issue.field}): ${issue.message}`,
              )
              .join('; '),
        );
      } else {
        toast.success(
          `Imported ${newRounds.length} round${newRounds.length === 1 ? '' : 's'} and ${questionCount} question${questionCount === 1 ? '' : 's'} — review and edit below.`,
        );
      }
    } catch (error) {
      setImportError(
        error instanceof ImportApiError
          ? error.message
          : 'Could not read that CSV.',
      );
    }
  }

  function updateRound(roundId: string, patch: Partial<EditorRound>): void {
    setRounds((current) =>
      current.map((round) =>
        round.id === roundId ? { ...round, ...patch } : round,
      ),
    );
  }

  function deleteRound(roundId: string): void {
    setRounds((current) => current.filter((round) => round.id !== roundId));
  }

  function moveRound(roundId: string, direction: -1 | 1): void {
    setRounds((current) => {
      const index = current.findIndex((round) => round.id === roundId);
      const targetIndex = index + direction;
      if (index === -1 || targetIndex < 0 || targetIndex >= current.length)
        return current;
      const copy = current.slice();
      [copy[index], copy[targetIndex]] = [copy[targetIndex], copy[index]];
      return copy;
    });
  }

  function addRound(): void {
    setRounds((current) => [
      ...current,
      makeRound(crypto.randomUUID(), `Round ${current.length + 1}`),
    ]);
  }

  async function handleSave(): Promise<void> {
    setIsSaving(true);
    setSaveError(null);
    setSaveIssues([]);
    const request = toSaveRequest(quizTitle, rounds);

    try {
      if (savedQuizId === null) {
        const result = await createQuiz(request);
        setSavedQuizId(result.quizId);
        router.replace(`/quizzes/${result.quizId}`);
      } else {
        await updateQuiz(savedQuizId, request);
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
      toast.success('Quiz saved');
    } catch (error) {
      if (error instanceof QuizDraftApiError) {
        setSaveError(error.message);
        setSaveIssues(error.issues);
      } else {
        setSaveError('Could not save the quiz.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (phase === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-display text-xl">Loading…</p>
      </main>
    );
  }

  if (phase === 'error') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        <p role="alert" className="font-extrabold text-magenta">
          {loadError}
        </p>
      </main>
    );
  }

  if (phase === 'empty') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-7 bg-background p-6 text-center text-foreground">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-magenta">
            Quiz editor
          </p>
          <h1 className="font-display text-3xl">Build a new quiz</h1>
          <p className="mx-auto mt-3 max-w-md text-sm font-bold text-foreground/60">
            Start from a blank round, or import a CSV of questions to edit from
            there.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <button
            type="button"
            onClick={startFromScratch}
            className="flex min-h-16 min-w-56 items-center justify-center gap-2 rounded-2xl bg-magenta px-6 font-display text-lg text-white"
          >
            <FilePlusIcon aria-hidden="true" />
            Start from scratch
          </button>
          <label className="flex min-h-16 min-w-56 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-foreground bg-white px-6 font-display text-lg text-foreground">
            <UploadIcon aria-hidden="true" />
            Import CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void handleCsvFile(event)}
              className="hidden"
            />
          </label>
        </div>
        {importError && (
          <p role="alert" className="font-extrabold text-magenta">
            {importError}
          </p>
        )}
      </main>
    );
  }

  const questionCount = rounds.reduce(
    (total, round) => total + round.questions.length,
    0,
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 bg-foreground px-5 py-4 text-background">
        <input
          value={quizTitle}
          onChange={(event) => setQuizTitle(event.target.value)}
          placeholder="Untitled quiz"
          className="min-w-48 flex-1 border-b-2 border-background/40 bg-transparent px-1 py-1 font-display text-xl text-background outline-none"
        />
        <span className="whitespace-nowrap text-xs font-bold text-background/60">
          {rounds.length} round{rounds.length === 1 ? '' : 's'} ·{' '}
          {questionCount} question
          {questionCount === 1 ? '' : 's'}
        </span>
        <label className="flex min-h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border-2 border-background/50 px-4 text-xs font-extrabold text-background">
          <UploadIcon aria-hidden="true" />
          Import CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void handleCsvFile(event)}
            className="hidden"
          />
        </label>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl bg-green px-5 text-xs font-extrabold text-white disabled:opacity-50"
        >
          <CheckIcon aria-hidden="true" />
          {savedFlash ? 'Saved ✓' : isSaving ? 'Saving…' : 'Save quiz'}
        </button>
      </div>

      {importError && (
        <p
          role="alert"
          className="bg-white px-5 py-3 font-extrabold text-magenta"
        >
          {importError}
        </p>
      )}
      {saveError && (
        <div
          role="alert"
          className="bg-white px-5 py-3 font-extrabold text-magenta"
        >
          <p>{saveError}</p>
          {saveIssues.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-xs font-bold">
              {saveIssues.map((issue, index) => (
                <li key={index}>{issueLabel(issue)}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-6">
        {rounds.map((round, index) => (
          <QuizRoundEditor
            key={round.id}
            round={round}
            isFirst={index === 0}
            isLast={index === rounds.length - 1}
            onChange={(patch) => updateRound(round.id, patch)}
            onDelete={() => deleteRound(round.id)}
            onMoveUp={() => moveRound(round.id, -1)}
            onMoveDown={() => moveRound(round.id, 1)}
          />
        ))}
        <button
          type="button"
          onClick={addRound}
          className="flex items-center gap-1.5 self-center rounded-2xl bg-foreground px-6 py-3 text-sm font-extrabold text-background"
        >
          <PlusIcon aria-hidden="true" />
          Add round
        </button>
      </div>
    </main>
  );
}
