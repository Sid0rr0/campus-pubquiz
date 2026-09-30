import { screen, waitFor } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/control/page';
import {
  authenticatedAuthResult,
  getDesktopButton,
  progress,
  adminView,
} from './test-utils';

const {
  mockUseAdminGame,
  mockFetchQuizzes,
  mockUseAuth,
  mockCloseSession,
  searchParamsRef,
  routerRef,
} = vi.hoisted(() => ({
  mockUseAdminGame: vi.fn(),
  mockFetchQuizzes: vi.fn(),
  mockUseAuth: vi.fn(),
  mockCloseSession: vi.fn(),
  searchParamsRef: { current: new URLSearchParams('code=TESTCODE') },
  routerRef: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock('@/app/lib/use-admin-game', async () => {
  const { adminGameResult } =
    await import('@/app/control/__tests__/test-utils');
  return {
    useAdminGame: (...args: unknown[]) =>
      adminGameResult(mockUseAdminGame(...args)),
  };
});

vi.mock('@/app/lib/quiz-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/quiz-api')>();
  return { ...actual, fetchQuizzes: mockFetchQuizzes };
});

vi.mock('@/app/lib/sessions-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/lib/sessions-api')>();
  return { ...actual, closeSession: mockCloseSession };
});

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => routerRef,
}));

describe('AdminPage — previous button', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams('code=TESTCODE');
    routerRef.push.mockReset();
    routerRef.replace.mockReset();
    mockUseAdminGame.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockFetchQuizzes.mockReset();
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
    mockCloseSession.mockReset();
  });

  it('sends PREVIOUS to step back to the round intro card from the very first question of the quiz', async () => {
    const sendAction = vi.fn();
    mockUseAdminGame.mockReturnValue({
      snapshot: adminView({
        progress: progress({ status: 'question_open' }),
        currentQuestion: {
          id: 'r1q1',
          type: 'free_text',
          prompt: 'Name a fruit',
          points: 1,
        },
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
        ],
      }),
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(getDesktopButton(/^previous$/i));

    expect(sendAction).toHaveBeenCalledWith('PREVIOUS');
  });

  it('sends PREVIOUS from the round intro card', async () => {
    const sendAction = vi.fn();
    mockUseAdminGame.mockReturnValue({
      snapshot: adminView({
        progress: progress({ status: 'round_intro' }),
        currentQuestion: null,
        roundTitle: 'Picture Round',
      }),
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(getDesktopButton(/^previous$/i));

    expect(sendAction).toHaveBeenCalledWith('PREVIOUS');
  });

  it('sends PREVIOUS when the Previous button is clicked after the first question of the open block', async () => {
    const sendAction = vi.fn();
    mockUseAdminGame.mockReturnValue({
      snapshot: adminView({
        progress: progress({ status: 'question_open', questionIndex: 1 }),
        currentQuestion: {
          id: 'r1q2',
          type: 'free_text',
          prompt: 'Name a vegetable',
          points: 1,
        },
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
          {
            id: 'r1q2',
            type: 'free_text',
            prompt: 'Name a vegetable',
            points: 1,
          },
        ],
      }),
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(getDesktopButton(/^previous$/i));

    expect(sendAction).toHaveBeenCalledWith('PREVIOUS');
  });

  it('sends PREVIOUS to step back from the locking countdown to the question', async () => {
    const sendAction = vi.fn();
    mockUseAdminGame.mockReturnValue({
      snapshot: adminView({
        progress: progress({ status: 'locking' }),
        currentQuestion: {
          id: 'r2q3',
          type: 'free_text',
          prompt: 'Name this song.',
          points: 3,
        },
        questionLockAt: Date.now() + 60_000,
      }),
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(getDesktopButton(/^previous$/i));

    expect(sendAction).toHaveBeenCalledWith('PREVIOUS');
  });

  it("shows the Previous button on the first question of the first block, during a break — it pauses on that round's own title card", async () => {
    const sendAction = vi.fn();
    mockUseAdminGame.mockReturnValue({
      snapshot: adminView({
        progress: progress({ status: 'break' }),
        currentQuestion: null,
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
          {
            id: 'r1q2',
            type: 'free_text',
            prompt: 'Name a vegetable',
            points: 1,
          },
        ],
      }),
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(getDesktopButton(/^previous$/i));

    expect(sendAction).toHaveBeenCalledWith('PREVIOUS');
  });

  it('hides the Previous button on the first round title card during break review, with no earlier block', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: adminView({
        progress: progress({ status: 'break_round_intro' }),
        currentQuestion: null,
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
          {
            id: 'r1q2',
            type: 'free_text',
            prompt: 'Name a vegetable',
            points: 1,
          },
        ],
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    expect(
      screen.queryByRole('button', { name: /^previous$/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the Previous button on a break round title card when an earlier block exists', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 'quiz-1',
      quizzes: [
        {
          id: 'quiz-1',
          title: 'Campus Pub Quiz Night',
          rounds: [
            {
              title: 'Round 1',
              breakAfter: true,
              questions: [
                { id: 'r1q1', prompt: 'Name a fruit', answer: 'Banana' },
              ],
            },
            {
              title: 'Round 2',
              breakAfter: true,
              questions: [
                { id: 'r2q1', prompt: 'Name this song.', answer: 'Yesterday' },
              ],
            },
          ],
        },
      ],
    });
    const sendAction = vi.fn();
    mockUseAdminGame.mockReturnValue({
      snapshot: adminView({
        // The server allows stepping back from here because an earlier block
        // exists; whether it does is decided (and tested) in the projection.
        canGoToPreviousQuestion: true,
        progress: progress({
          status: 'break_round_intro',
          roundIndex: 1,
          revealIndex: 0,
        }),
        currentQuestion: null,
        blockQuestions: [
          {
            id: 'r2q1',
            type: 'free_text',
            prompt: 'Name this song.',
            points: 1,
          },
        ],
        joinCode: 'TESTCODE',
      }),
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

    await waitFor(() =>
      expect(getDesktopButton(/^previous$/i)).toBeInTheDocument(),
    );
    await userEvent.click(getDesktopButton(/^previous$/i));

    expect(sendAction).toHaveBeenCalledWith('PREVIOUS');
  });

  it('shows the Previous button during a break once the admin has stepped back within the block', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: adminView({
        progress: progress({ status: 'break', roundIndex: 1, revealIndex: 1 }),
        currentQuestion: null,
        blockQuestions: [
          { id: 'r2q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
          {
            id: 'r2q2',
            type: 'free_text',
            prompt: 'Name a vegetable',
            points: 1,
          },
        ],
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    expect(getDesktopButton(/^previous$/i)).toBeInTheDocument();
  });

  it('shows the Previous button on the first question of a break when an earlier block exists', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 'quiz-1',
      quizzes: [
        {
          id: 'quiz-1',
          title: 'Campus Pub Quiz Night',
          rounds: [
            {
              title: 'Round 1',
              breakAfter: true,
              questions: [
                { id: 'r1q1', prompt: 'Name a fruit', answer: 'Banana' },
              ],
            },
            {
              title: 'Round 2',
              breakAfter: true,
              questions: [
                { id: 'r2q1', prompt: 'Name this song.', answer: 'Yesterday' },
              ],
            },
          ],
        },
      ],
    });
    mockUseAdminGame.mockReturnValue({
      snapshot: adminView({
        progress: progress({ status: 'break', roundIndex: 1, revealIndex: 0 }),
        currentQuestion: null,
        blockQuestions: [
          {
            id: 'r2q1',
            type: 'free_text',
            prompt: 'Name this song.',
            points: 1,
          },
        ],
        joinCode: 'TESTCODE',
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    await waitFor(() =>
      expect(getDesktopButton(/^previous$/i)).toBeInTheDocument(),
    );
  });

  it('shows the Previous button on the first reveal question, since it can still step back to the round intro card', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: adminView({
        progress: progress({ status: 'reveal', revealIndex: 0 }),
        currentQuestion: null,
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    expect(getDesktopButton(/^previous$/i)).toBeInTheDocument();
  });

  it("shows the Previous button on the first reveal round intro card, even with no earlier block — it re-enters that block's own break review", async () => {
    const sendAction = vi.fn();
    mockUseAdminGame.mockReturnValue({
      snapshot: adminView({
        progress: progress({ status: 'reveal_intro', revealIndex: 0 }),
        currentQuestion: null,
      }),
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(getDesktopButton(/^previous$/i));

    expect(sendAction).toHaveBeenCalledWith('PREVIOUS');
  });

  it('sends PREVIOUS from a later reveal question', async () => {
    const sendAction = vi.fn();
    mockUseAdminGame.mockReturnValue({
      snapshot: adminView({
        progress: progress({ status: 'reveal', revealIndex: 1 }),
        currentQuestion: null,
      }),
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(getDesktopButton(/^previous$/i));

    expect(sendAction).toHaveBeenCalledWith('PREVIOUS');
  });

  it('shows a disabled Previous button once the quiz has ended naturally, until the leaderboard is closed', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: adminView({
        progress: progress({
          status: 'ended',
          isLeaderboardVisible: true,
          previousStatus: 'reveal',
        }),
        currentQuestion: null,
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    expect(getDesktopButton(/^previous$/i)).toBeDisabled();
  });

  it('hides the Previous button on ended when no previousStatus was recorded (a legacy session)', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: adminView({
        progress: progress({ status: 'ended', isLeaderboardVisible: false }),
        currentQuestion: null,
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    expect(
      screen.queryByRole('button', { name: /^previous$/i }),
    ).not.toBeInTheDocument();
  });
});
