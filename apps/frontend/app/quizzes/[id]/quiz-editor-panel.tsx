'use client';

import {
  CheckIcon,
  DownloadIcon,
  EyeOpenIcon,
  FilePlusIcon,
  PlusIcon,
} from '@radix-ui/react-icons';
import { type QuizDraftIssue } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { FieldErrors, fieldIssues } from '@/app/quizzes/[id]/field-errors';
import {
  addRound,
  deleteRound,
  describeEditorRounds,
  moveQuestionToRound,
  moveRound,
  moveTargetRounds,
  structureNoteFor,
  updateRound,
} from '@/app/quizzes/[id]/quiz-draft-state';
import { QuizImportControls } from '@/app/quizzes/[id]/quiz-import-controls';
import { useQuizDraft } from '@/app/quizzes/[id]/use-quiz-draft';
import { useQuizImport } from '@/app/quizzes/[id]/use-quiz-import';
import { QuizOutline } from '@/app/quizzes/[id]/quiz-outline';
import { QuizRoundEditor } from '@/app/quizzes/[id]/quiz-round-editor';

interface QuizEditorPanelProps {
  quizId: string;
}

const EMPTY_OPENED_QUESTION_IDS: ReadonlySet<number> = new Set();

function issueLabel(issue: QuizDraftIssue): string {
  if (issue.roundIndex === -1) return `Quiz (${issue.field}): ${issue.message}`;
  const questionLabel =
    issue.questionIndex !== null ? `, Q${issue.questionIndex + 1}` : '';
  return `Round ${issue.roundIndex + 1}${questionLabel} (${issue.field}): ${issue.message}`;
}

const UNSAVED_PREVIEW_PROMPT =
  'You have unsaved changes. The preview shows the saved quiz, without them. Open it anyway?';

/** Opens the saved quiz's preview in a new tab, so the draft here stays; asks first when the draft has unsaved changes. */
function openPreview(quizId: number, isDirty: boolean): void {
  if (isDirty && !window.confirm(UNSAVED_PREVIEW_PROMPT)) return;
  window.open(`/quizzes/${quizId}/preview`, '_blank', 'noopener');
}

export function QuizEditorPanel({ quizId }: QuizEditorPanelProps) {
  const draft = useQuizDraft(quizId);
  const {
    rounds,
    editRounds,
    liveEdit,
    phase,
    saveIssues,
    saveError,
    savedFlash,
  } = draft;
  const quizImport = useQuizImport({
    rounds,
    title: draft.title,
    isEditorShowing: phase === 'editor',
    onApply: draft.applyImport,
  });
  const { importError } = quizImport;

  const isLive = liveEdit !== undefined;
  const described = describeEditorRounds(rounds, liveEdit);
  const openedQuestionIds = liveEdit
    ? new Set(liveEdit.openedQuestionIds)
    : EMPTY_OPENED_QUESTION_IDS;
  const quizLevelIssues = saveIssues.filter((issue) => issue.roundIndex === -1);

  if (draft.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-display text-xl">Loading…</p>
      </main>
    );
  }

  if (draft.loadError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        <p role="alert" className="font-extrabold text-magenta">
          {draft.loadError}
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
            Start from a blank round, import a CSV of questions, or paste a
            Google Sheets link to edit from there.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Button
            type="button"
            onClick={draft.startFromScratch}
            className="flex min-h-16 min-w-56 items-center justify-center gap-2 px-6 text-lg rounded-2xl bg-magenta font-display text-white"
          >
            <FilePlusIcon aria-hidden="true" />
            Start from scratch
          </Button>
          <QuizImportControls variant="empty" quizImport={quizImport} />
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
        <div className="flex min-w-48 flex-1 flex-col gap-0.5">
          <input
            value={draft.title}
            onChange={(event) => draft.setTitle(event.target.value)}
            placeholder="Untitled quiz"
            className="w-full border-b-2 border-background/40 bg-transparent px-1 py-1 font-display text-xl text-background outline-none"
          />
          <FieldErrors issues={fieldIssues(quizLevelIssues, 'title')} />
        </div>
        <span className="whitespace-nowrap text-xs font-bold text-background/60">
          {rounds.length} round{rounds.length === 1 ? '' : 's'} ·{' '}
          {questionCount} question
          {questionCount === 1 ? '' : 's'}
        </span>
        <QuizImportControls variant="toolbar" quizImport={quizImport} />
        <Button
          type="button"
          onClick={draft.exportCsv}
          disabled={questionCount === 0}
          size="md"
          className="rounded-xl border-2 border-background/50 text-xs font-extrabold text-background whitespace-nowrap disabled:opacity-50"
        >
          <DownloadIcon aria-hidden="true" />
          Export CSV
        </Button>
        {draft.savedQuizId !== null && (
          <Button
            type="button"
            onClick={() => openPreview(draft.savedQuizId!, draft.isDirty)}
            size="md"
            className="rounded-xl border-2 border-background/50 text-xs font-extrabold text-background whitespace-nowrap"
          >
            <EyeOpenIcon aria-hidden="true" />
            Preview
          </Button>
        )}
        <Button
          type="button"
          onClick={draft.save}
          disabled={draft.isSaving}
          size="md"
          className="rounded-xl bg-green text-xs font-extrabold text-white whitespace-nowrap disabled:opacity-50"
        >
          <CheckIcon aria-hidden="true" />
          {savedFlash ? 'Saved ✓' : draft.isSaving ? 'Saving…' : 'Save quiz'}
        </Button>
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
          {draft.isLiveEditConflict && (
            <Button
              type="button"
              onClick={() => draft.refreshLockState()}
              disabled={draft.isRefreshingLockState}
              size="sm"
              className="mt-2 rounded-lg bg-foreground px-3 py-1.5 text-xs font-extrabold text-background disabled:opacity-50"
            >
              {draft.isRefreshingLockState
                ? 'Refreshing…'
                : 'Refresh lock state'}
            </Button>
          )}
        </div>
      )}

      {isLive && (
        <p className="bg-cyan/20 px-5 py-3 text-xs font-extrabold text-foreground">
          A session is live on this quiz — questions can still be edited, but
          opened ones keep their type and choices. The current round and the
          rounds before it keep their place, break-after and kahoot setting; the
          rounds after it can be added, deleted, reordered and changed.
          Questions can be added, deleted, reordered and moved after the current
          round&apos;s last opened question (until its block starts locking) and
          in the rounds after it. Correcting an opened question&apos;s answer or
          points re-scores its auto-graded answers.
        </p>
      )}

      <div className="mx-auto flex max-w-6xl gap-6 px-5 py-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {rounds.map((round, index) => {
            const isLast = index === rounds.length - 1;
            const roundEditing = described?.[index];
            const isReached = roundEditing?.isReached ?? false;
            const isPreviousReached =
              index > 0 && !!described?.[index - 1].isReached;
            const isStructureFrozen =
              roundEditing?.structureEditing === 'frozen';
            const pinnedQuestionCount = roundEditing?.pinnedQuestionCount ?? 0;
            return (
              <div key={round.id} className="flex flex-col gap-4">
                <QuizRoundEditor
                  round={round}
                  index={index}
                  isFirst={index === 0}
                  isLast={isLast}
                  isReached={isReached}
                  isPreviousReached={isPreviousReached}
                  isStructureFrozen={isStructureFrozen}
                  pinnedQuestionCount={pinnedQuestionCount}
                  structureNote={roundEditing && structureNoteFor(roundEditing)}
                  moveTargetRounds={moveTargetRounds(rounds, index, described)}
                  openedQuestionIds={openedQuestionIds}
                  issues={saveIssues.filter(
                    (issue) => issue.roundIndex === index,
                  )}
                  onChange={(patch) =>
                    editRounds((current) =>
                      updateRound(current, round.id, patch),
                    )
                  }
                  onDelete={() =>
                    editRounds((current) => deleteRound(current, round.id))
                  }
                  onMoveUp={() =>
                    editRounds((current) => moveRound(current, round.id, -1))
                  }
                  onMoveDown={() =>
                    editRounds((current) => moveRound(current, round.id, 1))
                  }
                  onMoveQuestionToRound={(questionId, targetRoundId) =>
                    editRounds((current) =>
                      moveQuestionToRound(current, questionId, targetRoundId),
                    )
                  }
                />
                {!isLast &&
                  (round.breakAfter ? (
                    <div
                      role="separator"
                      className="flex items-center gap-4 py-2"
                    >
                      <div className="h-1 flex-1 rounded-full bg-magenta/30" />
                      <span className="shrink-0 rounded-full bg-magenta px-5 py-2 text-sm font-extrabold uppercase tracking-wide text-white">
                        Break
                      </span>
                      <div className="h-1 flex-1 rounded-full bg-magenta/30" />
                    </div>
                  ) : (
                    <div role="separator" className="h-1 bg-foreground" />
                  ))}
              </div>
            );
          })}
          <FieldErrors issues={fieldIssues(quizLevelIssues, 'rounds')} />
          <Button
            type="button"
            onClick={() =>
              editRounds((current) => addRound(current, crypto.randomUUID()))
            }
            className="flex items-center gap-1.5 self-center rounded-2xl bg-foreground px-6 py-3 text-sm font-extrabold text-background disabled:opacity-50"
          >
            <PlusIcon aria-hidden="true" />
            Add round
          </Button>
        </div>
        <QuizOutline
          rounds={rounds}
          liveEdit={liveEdit}
          onReorderRounds={(reordered) => editRounds(() => reordered)}
          onReorderQuestions={(roundId, questions) =>
            editRounds((current) =>
              updateRound(current, roundId, { questions }),
            )
          }
        />
      </div>
    </main>
  );
}
