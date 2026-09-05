import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/control/page';
import {
  authenticatedAuthResult,
  getDesktopButton,
  progress,
} from './test-utils';

const {
  mockUseGameSocket,
  mockFetchQuizzes,
  mockUseAuth,
  mockCloseSession,
  searchParamsRef,
  routerRef,
} = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  mockFetchQuizzes: vi.fn(),
  mockUseAuth: vi.fn(),
  mockCloseSession: vi.fn(),
  searchParamsRef: { current: new URLSearchParams('code=TESTCODE') },
  routerRef: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

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

describe('AdminPage — advance controls', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams('code=TESTCODE');
    routerRef.push.mockReset();
    routerRef.replace.mockReset();
    mockUseGameSocket.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockFetchQuizzes.mockReset();
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
    mockCloseSession.mockReset();
  });

  it('sends START_QUIZ when the Start Quiz button is clicked', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'lobby' }),
        currentQuestion: null,
      },
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /start quiz/i }));

    expect(sendAction).toHaveBeenCalledWith('START_QUIZ');
  });

  it('sends ADVANCE when the Advance button is clicked', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: null,
      },
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(getDesktopButton(/advance/i));

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });

  it('shows a "Begin Quiz" button that sends ADVANCE while showing the rules screen', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'rules' }),
        currentQuestion: null,
      },
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(getDesktopButton(/begin quiz/i));

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });

  it('shows a "Start Round" button that sends ADVANCE on the round intro card', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'round_intro' }),
        currentQuestion: null,
        roundTitle: 'Picture Round',
      },
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(getDesktopButton(/start round/i));

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });

  it('shows an Advance button that sends ADVANCE during the locking countdown, to skip it early', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'locking' }),
        currentQuestion: {
          id: 'r2q3',
          type: 'free_text',
          prompt: 'Name this song.',
          points: 3,
        },
        questionLockAt: Date.now() + 60_000,
      },
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(getDesktopButton(/^advance$/i));

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });

  it('does not offer a per-question lock control (locking is block-based)', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: null,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    expect(
      screen.queryByRole('button', { name: /lock answers/i }),
    ).not.toBeInTheDocument();
  });

  it('sends ADVANCE when the Advance button is clicked during a break', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break' }),
        currentQuestion: null,
      },
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(getDesktopButton(/^advance$/i));

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });

  it('sends ADVANCE to step through reveal questions', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'reveal', revealIndex: 0 }),
        currentQuestion: null,
      },
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(getDesktopButton(/^advance$/i));

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });
});
