import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  type LiveEditFrontier,
  type QuizDraftIssue,
} from '@campus-pubquiz/types';
import {
  createQuiz,
  fetchQuizDraft,
  QuizDraftApiError,
  updateQuiz,
} from '@/app/lib/quiz-draft-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { downloadTextFile } from '@/app/lib/download-text-file';
import { queryKeys } from '@/app/lib/query-keys';
import { csvFilename, quizToCsv } from '@/app/lib/quiz-csv-export';
import {
  makeRound,
  plural,
  titleAfterImport,
  type ImportOutcome,
  roundFromPreview,
  toSaveRequest,
  withSyncedQuestionIds,
  type EditorRound,
} from '@/app/quizzes/[id]/quiz-draft-state';

export type QuizDraftPhase = 'empty' | 'editor';

/** What a save would send, minus the ids the server assigns, so a refetch that backfills them doesn't read as an edit. */
function fingerprintOf(request: ReturnType<typeof toSaveRequest>): string {
  return JSON.stringify(request, (key, value: unknown) =>
    key === 'questionId' ? undefined : value,
  );
}

const EMPTY_ISSUES: QuizDraftIssue[] = [];
const SAVED_FLASH_MS = 1600;
const CSV_MIME_TYPE = 'text/csv;charset=utf-8';
const LIVE_EDIT_CONFLICT_MESSAGE =
  'Someone advanced the live session while you were editing — refresh to see what changed, then try again.';

/** The message shown for a rejected save, both in the toast fired from `onError` and in the persisted banner rendered from `saveMutation.error`. */
function saveErrorMessage(error: unknown): string {
  if (error instanceof QuizDraftApiError && error.status === 409) {
    return LIVE_EDIT_CONFLICT_MESSAGE;
  }
  return (
    apiErrorMessage(error, QuizDraftApiError, 'Could not save the quiz.') ??
    // Stryker disable next-line StringLiteral: only reached for a null error, which a rejected save never carries
    'Could not save the quiz.'
  );
}

export interface QuizDraft {
  isLoading: boolean;
  loadError: string | null;
  phase: QuizDraftPhase;
  startFromScratch: () => void;
  title: string;
  setTitle: (title: string) => void;
  rounds: EditorRound[];
  /** Applies a pure round edit (current rounds in, new rounds out). */
  editRounds: (edit: (rounds: EditorRound[]) => EditorRound[]) => void;
  /** Replaces the draft's rounds and title (an import's outcome) and shows the editor. */
  applyImport: (outcome: ImportOutcome) => void;
  liveEdit: LiveEditFrontier | undefined;
  refreshLockState: () => void;
  isRefreshingLockState: boolean;
  save: () => void;
  isSaving: boolean;
  /** The id of the saved quiz this draft edits, or null until a new quiz is first saved. */
  savedQuizId: number | null;
  /** Whether the draft differs from the last saved or loaded copy. */
  isDirty: boolean;
  savedFlash: boolean;
  exportCsv: () => void;
  saveError: string | null;
  saveIssues: QuizDraftIssue[];
  isLiveEditConflict: boolean;
}

/** Loads a quiz (or starts a new one) into an editable draft and saves it. */
export function useQuizDraft(quizId: string): QuizDraft {
  const router = useRouter();
  const queryClient = useQueryClient();
  const numericQuizId = quizId === 'new' ? null : Number(quizId);

  const draftQuery = useQuery({
    // Stryker disable next-line UnaryOperator: a new quiz leaves the query disabled, so its placeholder key is never read
    queryKey: queryKeys.quizzes.draft(numericQuizId ?? -1),
    queryFn: () => fetchQuizDraft(numericQuizId as number),
    enabled: numericQuizId !== null,
    // The draft is copied into editable local state below (see
    // hydratedQuizId/mergedDraft state below) — staleTime Infinity just avoids
    // pointless background refetches while mounted; a post-save
    // invalidateQueries still forces one, and that's fine, since the sync
    // logic below only merges dbIds in rather than re-copying. gcTime 0
    // drops it on unmount so leaving and coming back reloads fresh.
    staleTime: Infinity,
    gcTime: 0,
  });
  const loadError =
    apiErrorMessage(
      draftQuery.error,
      QuizDraftApiError,
      'Could not load that quiz.',
    ) ?? null;

  // For an existing quiz, the loading state blocks every render until the
  // adjustment below flips this to 'editor', so this initial value is inert
  // for that case — 'empty' only actually renders for a new quiz.
  const [phase, setPhase] = useState<QuizDraftPhase>('empty');
  const [title, setTitle] = useState('');
  const [rounds, setRounds] = useState<EditorRound[]>([]);
  const [savedQuizId, setSavedQuizId] = useState<number | null>(numericQuizId);
  // The draft as last loaded or saved, to tell whether the editor has unsaved changes.
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [savedFlashRun, setSavedFlashRun] = useState(0);
  const [liveEdit, setLiveEdit] = useState<LiveEditFrontier | undefined>(
    undefined,
  );

  // Copies the draft into editable local state exactly once per quizId —
  // adjusted during render rather than in an Effect, the same idiom used
  // elsewhere in this codebase (e.g. AdminPageContent's session-switch
  // resets). Guarded by quizId rather than by `draftQuery.data` identity:
  // a post-save cache invalidation (see saveMutation below) refetches this
  // same query and hands back a new object identity every time, and
  // re-copying on every one of those would wipe out whatever the admin
  // typed since the save — which is what made a second save look broken.
  const [hydratedQuizId, setHydratedQuizId] = useState<
    number | null | undefined
  >(undefined);
  const [mergedDraft, setMergedDraft] = useState(draftQuery.data);
  if (draftQuery.data && hydratedQuizId !== numericQuizId) {
    setHydratedQuizId(numericQuizId);
    setMergedDraft(draftQuery.data);
    const hydratedRounds = draftQuery.data.rounds.map((round) =>
      roundFromPreview(crypto.randomUUID(), round, () => crypto.randomUUID()),
    );
    setTitle(draftQuery.data.title);
    setRounds(hydratedRounds);
    setSavedFingerprint(
      fingerprintOf(toSaveRequest(draftQuery.data.title, hydratedRounds)),
    );
    setLiveEdit(draftQuery.data.liveEdit);
    setPhase('editor');
  } else if (draftQuery.data && draftQuery.data !== mergedDraft) {
    // A background refetch of the same quiz (e.g. the post-save cache
    // invalidation below) — backfill any newly-assigned question dbIds
    // rather than re-copying the whole draft, so it can't clobber edits
    // made since the fetch was kicked off.
    setMergedDraft(draftQuery.data);
    setRounds((current) =>
      withSyncedQuestionIds(current, draftQuery.data!.rounds),
    );
  }

  // Hides the flash after a moment; re-saving restarts the timer and
  // unmounting cancels it.
  useEffect(() => {
    // Stryker disable next-line ConditionalExpression: with the flash already off, the timer it starts only sets it off again
    if (!savedFlash) return;
    const timer = setTimeout(() => setSavedFlash(false), SAVED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [savedFlash, savedFlashRun]);

  const refreshLockStateMutation = useMutation({
    mutationFn: () => fetchQuizDraft(numericQuizId as number),
    onSuccess: (draft) => setLiveEdit(draft.liveEdit),
  });

  const saveMutation = useMutation({
    mutationFn: (request: ReturnType<typeof toSaveRequest>) =>
      savedQuizId === null
        ? createQuiz(request)
        : updateQuiz(savedQuizId, request),
    onSuccess: (result, request) => {
      setSavedFingerprint(fingerprintOf(request));
      if (savedQuizId === null) {
        setSavedQuizId(result.quizId);
        router.replace(`/quizzes/${result.quizId}`);
      }
      setSavedFlash(true);
      // Stryker disable next-line ArithmeticOperator: the counter only has to change to restart the flash timer, either direction does
      setSavedFlashRun((run) => run + 1);
      toast.success('Quiz saved');
      void queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.all });
    },
    onError: (error) => {
      const issueCount =
        error instanceof QuizDraftApiError ? error.issues.length : 0;
      toast.error(
        issueCount > 0
          ? `${saveErrorMessage(error)} (${plural(issueCount, 'issue')} — see below)`
          : saveErrorMessage(error),
      );
    },
  });

  // Exports what's in the editor right now (unsaved edits included), not the
  // last-saved copy — the CSV is a snapshot of the draft the admin is looking at.
  function exportCsv(): void {
    const request = toSaveRequest(title, rounds);
    downloadTextFile(
      csvFilename(request.title),
      quizToCsv(request.rounds),
      CSV_MIME_TYPE,
    );
  }

  return {
    isLoading: numericQuizId !== null && draftQuery.isPending,
    loadError,
    phase,
    startFromScratch: () => {
      setRounds([makeRound(crypto.randomUUID(), 'Round 1')]);
      setPhase('editor');
    },
    title,
    setTitle,
    rounds,
    editRounds: (edit) => setRounds(edit),
    applyImport: (outcome) => {
      setRounds(outcome.rounds);
      setTitle((current) => titleAfterImport(current, outcome.title));
      setPhase('editor');
    },
    liveEdit,
    refreshLockState: () => refreshLockStateMutation.mutate(),
    isRefreshingLockState: refreshLockStateMutation.isPending,
    save: () => saveMutation.mutate(toSaveRequest(title, rounds)),
    isSaving: saveMutation.isPending,
    savedQuizId,
    isDirty: fingerprintOf(toSaveRequest(title, rounds)) !== savedFingerprint,
    savedFlash,
    exportCsv,
    saveError: saveMutation.error ? saveErrorMessage(saveMutation.error) : null,
    saveIssues:
      saveMutation.error instanceof QuizDraftApiError
        ? saveMutation.error.issues
        : EMPTY_ISSUES,
    isLiveEditConflict:
      saveMutation.error instanceof QuizDraftApiError &&
      saveMutation.error.status === 409,
  };
}
