import { screen, waitFor, within } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/admin/page';
import { authenticatedAuthResult, progress } from './test-utils';

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

describe('AdminPage — end quiz and close session', () => {
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

  it('asks for confirmation before ending the quiz', async () => {
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

    await userEvent.click(screen.getByRole('button', { name: /end quiz/i }));

    expect(
      screen.getByRole('alertdialog', { name: /end this quiz\?/i }),
    ).toBeInTheDocument();
    expect(sendAction).not.toHaveBeenCalled();
  });

  it('does not end the quiz when the confirmation is cancelled', async () => {
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

    await userEvent.click(screen.getByRole('button', { name: /end quiz/i }));
    const dialog = screen.getByRole('alertdialog', {
      name: /end this quiz\?/i,
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: /^cancel$/i }),
    );

    expect(
      screen.queryByRole('alertdialog', { name: /end this quiz\?/i }),
    ).not.toBeInTheDocument();
    expect(sendAction).not.toHaveBeenCalled();
  });

  it('sends END_QUIZ once the confirmation dialog is confirmed', async () => {
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

    await userEvent.click(screen.getByRole('button', { name: /end quiz/i }));
    const dialog = screen.getByRole('alertdialog', {
      name: /end this quiz\?/i,
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: /end quiz/i }),
    );

    expect(sendAction).toHaveBeenCalledWith('END_QUIZ');
  });

  it('does not show the Close Session button while the quiz is still running', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: null,
        joinCode: 'TESTCODE',
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    expect(
      screen.queryByRole('button', { name: /close session/i }),
    ).not.toBeInTheDocument();
  });

  it('asks for confirmation before closing the session', async () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'ended' }),
        currentQuestion: null,
        joinCode: 'TESTCODE',
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(
      screen.getByRole('button', { name: /close session/i }),
    );

    expect(
      screen.getByRole('alertdialog', { name: /close this session\?/i }),
    ).toBeInTheDocument();
    expect(mockCloseSession).not.toHaveBeenCalled();
  });

  it('does not close the session when the confirmation is cancelled', async () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'ended' }),
        currentQuestion: null,
        joinCode: 'TESTCODE',
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(
      screen.getByRole('button', { name: /close session/i }),
    );
    const dialog = screen.getByRole('alertdialog', {
      name: /close this session\?/i,
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: /^cancel$/i }),
    );

    expect(
      screen.queryByRole('alertdialog', { name: /close this session\?/i }),
    ).not.toBeInTheDocument();
    expect(mockCloseSession).not.toHaveBeenCalled();
  });

  it('closes the session and redirects to /sessions once the confirmation dialog is confirmed', async () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'ended' }),
        currentQuestion: null,
        joinCode: 'TESTCODE',
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    mockCloseSession.mockResolvedValue(undefined);
    renderWithQuery(<AdminPage />);

    await userEvent.click(
      screen.getByRole('button', { name: /close session/i }),
    );
    const dialog = screen.getByRole('alertdialog', {
      name: /close this session\?/i,
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: /close session/i }),
    );

    expect(mockCloseSession).toHaveBeenCalledWith('TESTCODE');
    await waitFor(() =>
      expect(routerRef.push).toHaveBeenCalledWith('/sessions'),
    );
  });

  it('shows an error when closing the session fails', async () => {
    const { SessionApiError } = await import('@/app/lib/sessions-api');
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'ended' }),
        currentQuestion: null,
        joinCode: 'TESTCODE',
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    mockCloseSession.mockRejectedValue(
      new SessionApiError('still the default session', 409),
    );
    renderWithQuery(
      <>
        <AdminPage />
        <Toaster />
      </>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /close session/i }),
    );
    const dialog = screen.getByRole('alertdialog', {
      name: /close this session\?/i,
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: /close session/i }),
    );

    expect(
      await screen.findByText(/still the default session/i),
    ).toBeInTheDocument();
    expect(routerRef.push).not.toHaveBeenCalledWith('/sessions');
  });
});
