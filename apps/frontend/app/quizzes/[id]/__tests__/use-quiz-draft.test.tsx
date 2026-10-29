import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ImportRoundPreview } from '@campus-pubquiz/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizDraftApiError } from '@/app/lib/quiz-draft-api';
import { queryKeys } from '@/app/lib/query-keys';
import { useQuizDraft } from '@/app/quizzes/[id]/use-quiz-draft';
import {
  makeQuestion,
  makeRound,
  type EditorRound,
} from '@/app/quizzes/[id]/quiz-draft-state';

const {
  routerRef,
  mockFetchQuizDraft,
  mockCreateQuiz,
  mockUpdateQuiz,
  mockToast,
} = vi.hoisted(() => ({
  routerRef: { push: vi.fn(), replace: vi.fn() },
  mockFetchQuizDraft: vi.fn(),
  mockCreateQuiz: vi.fn(),
  mockUpdateQuiz: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => routerRef }));
vi.mock('sonner', () => ({ toast: mockToast }));
vi.mock('@/app/lib/quiz-draft-api', async () => {
  const actual = await vi.importActual<
    typeof import('@/app/lib/quiz-draft-api')
  >('@/app/lib/quiz-draft-api');
  return {
    ...actual,
    fetchQuizDraft: mockFetchQuizDraft,
    createQuiz: mockCreateQuiz,
    updateQuiz: mockUpdateQuiz,
  };
});

const SAVED = {
  quizId: 9,
  roundCount: 1,
  questionCount: 0,
  updatedAt: '2026-10-28T20:05:00.000Z',
};

const emptyRound: ImportRoundPreview = {
  title: 'History',
  breakAfter: true,
  questions: [],
};

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function renderDraft(quizId: string) {
  return renderHook(() => useQuizDraft(quizId), { wrapper });
}

/** A new quiz with one round, ready to save. */
async function renderStartedNewQuiz() {
  const view = renderDraft('new');
  act(() => view.result.current.startFromScratch());
  return view;
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  for (const mock of [
    routerRef.replace,
    mockFetchQuizDraft,
    mockCreateQuiz,
    mockUpdateQuiz,
    mockToast.success,
    mockToast.error,
  ]) {
    mock.mockReset();
  }
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loading a quiz', () => {
  it('is loading until an existing quiz arrives, then shows it in the editor', async () => {
    mockFetchQuizDraft.mockResolvedValue({
      id: 5,
      title: 'Trivia Night',
      rounds: [emptyRound],
    });

    const { result } = renderDraft('5');

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.phase).toBe('editor');
    expect(result.current.title).toBe('Trivia Night');
    expect(result.current.savedQuizId).toBe(5);
    expect(result.current.isDirty).toBe(false);
  });

  it('copies the loaded rounds into the editor once, without the refetch backfill copying them again', async () => {
    mockFetchQuizDraft.mockResolvedValue({
      id: 5,
      title: 'T',
      rounds: [emptyRound],
    });
    const roundsSeen = new Set<unknown>();

    const { result } = renderHook(
      () => {
        const draft = useQuizDraft('5');
        roundsSeen.add(draft.rounds);
        return draft;
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.phase).toBe('editor'));

    // The empty list before the load, then the hydrated rounds.
    expect(roundsSeen.size).toBe(2);
  });

  it('is not loading for a new quiz, which starts on the empty state', () => {
    const { result } = renderDraft('new');

    expect(result.current.isLoading).toBe(false);
    expect(result.current.phase).toBe('empty');
    expect(result.current.savedQuizId).toBeNull();
    expect(mockFetchQuizDraft).not.toHaveBeenCalled();
  });

  it('reports a quiz that fails to load with a fallback message', async () => {
    mockFetchQuizDraft.mockRejectedValue(new Error('network down'));

    const { result } = renderDraft('5');

    await waitFor(() =>
      expect(result.current.loadError).toBe('Could not load that quiz.'),
    );
  });

  it('keeps the live-edit frontier of the loaded quiz', async () => {
    const liveEdit = {
      openedQuestionIds: [1],
      currentRoundIndex: 0,
      hasCurrentBlockStartedLocking: false,
    };
    mockFetchQuizDraft.mockResolvedValue({
      id: 5,
      title: 'T',
      rounds: [emptyRound],
      liveEdit,
    });

    const { result } = renderDraft('5');

    await waitFor(() => expect(result.current.liveEdit).toEqual(liveEdit));
  });

  it('updates the live-edit frontier when the lock state is refreshed', async () => {
    mockFetchQuizDraft.mockResolvedValueOnce({
      id: 5,
      title: 'T',
      rounds: [emptyRound],
    });
    const { result } = renderDraft('5');
    await waitFor(() => expect(result.current.phase).toBe('editor'));
    const liveEdit = {
      openedQuestionIds: [42],
      currentRoundIndex: 0,
      hasCurrentBlockStartedLocking: true,
    };
    mockFetchQuizDraft.mockResolvedValueOnce({
      id: 5,
      title: 'T',
      rounds: [emptyRound],
      liveEdit,
    });

    act(() => result.current.refreshLockState());

    await waitFor(() => expect(result.current.liveEdit).toEqual(liveEdit));
  });
});

describe('a background refetch after loading', () => {
  it('backfills the id of a question added since the load without marking the draft dirty', async () => {
    mockFetchQuizDraft.mockResolvedValueOnce({
      id: 5,
      title: 'T',
      rounds: [emptyRound],
    });
    mockUpdateQuiz.mockResolvedValue({ ...SAVED, quizId: 5 });
    const { result } = renderDraft('5');
    await waitFor(() => expect(result.current.phase).toBe('editor'));
    act(() =>
      result.current.editRounds((rounds) =>
        rounds.map((round) => ({
          ...round,
          questions: [
            {
              ...makeQuestion('q1'),
              type: 'free_text' as const,
              prompt: 'Largest planet?',
              correctText: 'Jupiter',
            },
          ],
        })),
      ),
    );
    mockFetchQuizDraft.mockResolvedValue({
      id: 5,
      title: 'T',
      rounds: [
        {
          ...emptyRound,
          questions: [
            {
              questionId: 77,
              type: 'free_text',
              prompt: 'Largest planet?',
              answer: 'Jupiter',
              points: 1,
            },
          ],
        },
      ],
    });

    act(() => result.current.save());

    await waitFor(() =>
      expect(result.current.rounds[0].questions[0].dbId).toBe(77),
    );
    expect(result.current.isDirty).toBe(false);
  });
});

describe('saving', () => {
  it('creates a new quiz, remembers its id, redirects, and updates it on the next save', async () => {
    mockCreateQuiz.mockResolvedValue(SAVED);
    mockUpdateQuiz.mockResolvedValue(SAVED);
    const { result } = await renderStartedNewQuiz();

    act(() => result.current.save());
    await waitFor(() => expect(result.current.savedQuizId).toBe(9));

    expect(routerRef.replace).toHaveBeenCalledWith('/quizzes/9');
    expect(mockToast.success).toHaveBeenCalledWith('Quiz saved');
    expect(result.current.isDirty).toBe(false);

    act(() => result.current.save());
    await waitFor(() => expect(mockUpdateQuiz).toHaveBeenCalledTimes(1));
    expect(mockUpdateQuiz).toHaveBeenCalledWith(9, expect.anything());
    expect(mockCreateQuiz).toHaveBeenCalledTimes(1);
  });

  it('does not redirect when an existing quiz is updated', async () => {
    mockFetchQuizDraft.mockResolvedValue({
      id: 5,
      title: 'T',
      rounds: [emptyRound],
    });
    mockUpdateQuiz.mockResolvedValue({ ...SAVED, quizId: 5 });
    const { result } = renderDraft('5');
    await waitFor(() => expect(result.current.phase).toBe('editor'));

    act(() => result.current.save());

    await waitFor(() => expect(mockToast.success).toHaveBeenCalled());
    expect(routerRef.replace).not.toHaveBeenCalled();
  });

  it('saves from the version it loaded, then from the version the last save returned', async () => {
    mockFetchQuizDraft.mockResolvedValue({
      id: 5,
      title: 'T',
      updatedAt: '2026-10-28T20:00:00.000Z',
      rounds: [emptyRound],
    });
    mockUpdateQuiz.mockResolvedValue({ ...SAVED, quizId: 5 });
    const { result } = renderDraft('5');
    await waitFor(() => expect(result.current.phase).toBe('editor'));

    act(() => result.current.save());
    await waitFor(() => expect(mockUpdateQuiz).toHaveBeenCalledTimes(1));
    expect(mockUpdateQuiz).toHaveBeenLastCalledWith(
      5,
      expect.objectContaining({ loadedUpdatedAt: '2026-10-28T20:00:00.000Z' }),
    );

    await waitFor(() => expect(mockToast.success).toHaveBeenCalled());
    act(() => result.current.save());
    await waitFor(() => expect(mockUpdateQuiz).toHaveBeenCalledTimes(2));
    expect(mockUpdateQuiz).toHaveBeenLastCalledWith(
      5,
      expect.objectContaining({ loadedUpdatedAt: SAVED.updatedAt }),
    );
  });

  it('refreshes every cached quiz query after a save', async () => {
    mockCreateQuiz.mockResolvedValue(SAVED);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderStartedNewQuiz();

    act(() => result.current.save());

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: queryKeys.quizzes.all,
      }),
    );
  });

  describe('the saved flash', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    it('shows after a save and clears 1.6 seconds later', async () => {
      mockCreateQuiz.mockResolvedValue(SAVED);
      mockUpdateQuiz.mockResolvedValue(SAVED);
      const { result } = await renderStartedNewQuiz();
      expect(result.current.savedFlash).toBe(false);

      act(() => result.current.save());
      await waitFor(() => expect(result.current.savedFlash).toBe(true));

      await act(() => vi.advanceTimersByTimeAsync(1500));
      expect(result.current.savedFlash).toBe(true);
      await act(() => vi.advanceTimersByTimeAsync(200));
      expect(result.current.savedFlash).toBe(false);
    });

    it('restarts the 1.6 seconds when saved again while it is showing', async () => {
      mockCreateQuiz.mockResolvedValue(SAVED);
      mockUpdateQuiz.mockResolvedValue(SAVED);
      const { result } = await renderStartedNewQuiz();
      act(() => result.current.save());
      await waitFor(() => expect(result.current.savedFlash).toBe(true));
      await act(() => vi.advanceTimersByTimeAsync(1000));

      act(() => result.current.save());
      await waitFor(() => expect(mockUpdateQuiz).toHaveBeenCalled());
      await act(() => vi.advanceTimersByTimeAsync(1000));

      expect(result.current.savedFlash).toBe(true);
      await act(() => vi.advanceTimersByTimeAsync(800));
      expect(result.current.savedFlash).toBe(false);
    });
  });

  describe('a rejected save', () => {
    it('says why with the server message, and flags no conflict for a validation error', async () => {
      mockCreateQuiz.mockRejectedValue(
        new QuizDraftApiError('Validation failed', 422),
      );
      const { result } = await renderStartedNewQuiz();

      act(() => result.current.save());

      await waitFor(() =>
        expect(result.current.saveError).toBe('Validation failed'),
      );
      expect(mockToast.error).toHaveBeenCalledWith('Validation failed');
      expect(result.current.isLiveEditConflict).toBe(false);
      expect(result.current.saveIssues).toEqual([]);
    });

    it('adds the issue count to the toast when the server lists issues', async () => {
      const issues = [
        {
          roundIndex: 0,
          questionIndex: 0,
          field: 'prompt',
          message: 'Missing',
        },
        { roundIndex: 0, questionIndex: 1, field: 'answer', message: 'Blank' },
      ];
      mockCreateQuiz.mockRejectedValue(
        new QuizDraftApiError('Validation failed', 422, issues),
      );
      const { result } = await renderStartedNewQuiz();

      act(() => result.current.save());

      await waitFor(() =>
        expect(mockToast.error).toHaveBeenCalledWith(
          'Validation failed (2 issues — see below)',
        ),
      );
      expect(result.current.saveIssues).toEqual(issues);
    });

    it('falls back to a generic message for a failure that is not an API error', async () => {
      mockCreateQuiz.mockRejectedValue(new Error('network down'));
      const { result } = await renderStartedNewQuiz();

      act(() => result.current.save());

      await waitFor(() =>
        expect(result.current.saveError).toBe('Could not save the quiz.'),
      );
      expect(mockToast.error).toHaveBeenCalledWith('Could not save the quiz.');
      expect(result.current.isLiveEditConflict).toBe(false);
    });

    it('flags a 409 as a live-edit conflict with its own message', async () => {
      mockCreateQuiz.mockRejectedValue(new QuizDraftApiError('Conflict', 409));
      const { result } = await renderStartedNewQuiz();

      act(() => result.current.save());

      await waitFor(() => expect(result.current.isLiveEditConflict).toBe(true));
      expect(result.current.saveError).toMatch(/refresh to see what changed/i);
    });
  });
});

describe('editing the draft', () => {
  it('marks the draft dirty after an edit and clean again once saved', async () => {
    mockCreateQuiz.mockResolvedValue(SAVED);
    const { result } = await renderStartedNewQuiz();
    act(() => result.current.setTitle('Pub night'));
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.save());

    await waitFor(() => expect(result.current.isDirty).toBe(false));
  });

  it('keeps the typed title when an import brings another one', () => {
    const { result } = renderDraft('new');
    act(() => result.current.setTitle('Mine'));
    const rounds: EditorRound[] = [makeRound('r1', 'Imported')];

    act(() =>
      result.current.applyImport({
        rounds,
        title: 'From file',
        result: { kind: 'summary', message: 'ok' },
      }),
    );

    expect(result.current.title).toBe('Mine');
    expect(result.current.rounds).toBe(rounds);
    expect(result.current.phase).toBe('editor');
  });
});
