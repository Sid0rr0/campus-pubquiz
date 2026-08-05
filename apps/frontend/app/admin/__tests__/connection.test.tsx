import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/admin/page';
import { AuthApiError } from '@/app/lib/auth-api';
import { progress } from './test-utils';

const { mockUseGameSocket, mockFetchQuizzes, mockLogin, mockRegister, mockFetchMe, mockLogout } = vi.hoisted(
  () => ({
    mockUseGameSocket: vi.fn(),
    mockFetchQuizzes: vi.fn(),
    mockLogin: vi.fn(),
    mockRegister: vi.fn(),
    mockFetchMe: vi.fn(),
    mockLogout: vi.fn(),
  }),
);

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('@/app/lib/quiz-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/quiz-api')>();
  return { ...actual, fetchQuizzes: mockFetchQuizzes };
});

vi.mock('@/app/lib/auth-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/auth-api')>();
  return {
    ...actual,
    login: mockLogin,
    register: mockRegister,
    fetchMe: mockFetchMe,
    logout: mockLogout,
  };
});

const AUTH_USER = { id: 1, username: 'alice', role: 'admin' as const, status: 'active' as const };
const NO_SESSION_ERROR = new AuthApiError('Missing or invalid session cookie', 401);

describe('AdminPage — connection', () => {
  beforeEach(() => {
    mockUseGameSocket.mockReset();
    mockFetchQuizzes.mockReset();
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
    mockLogin.mockReset();
    mockRegister.mockReset();
    mockFetchMe.mockReset();
    mockFetchMe.mockRejectedValue(NO_SESSION_ERROR);
    mockLogout.mockReset();
  });

  it('shows the login form before authenticating', async () => {
    mockUseGameSocket.mockReturnValue({ snapshot: null, connectionError: null, sendAction: vi.fn() });
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByLabelText(/username/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('logs in and connects the socket hook', async () => {
    const user = userEvent.setup();
    mockUseGameSocket.mockReturnValue({ snapshot: null, connectionError: null, sendAction: vi.fn() });
    mockLogin.mockResolvedValue({ user: AUTH_USER });
    render(<AdminPage />);

    await waitFor(() => screen.getByLabelText(/username/i));
    await user.type(screen.getByLabelText(/username/i), 'alice');
    await user.type(screen.getByLabelText(/^password$/i), 'hunter2');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(mockLogin).toHaveBeenCalledWith('alice', 'hunter2');
    await waitFor(() => expect(mockUseGameSocket).toHaveBeenLastCalledWith('admin', true));
  });

  it('restores an existing session after a refresh and reconnects automatically', async () => {
    mockFetchMe.mockReset();
    mockFetchMe.mockResolvedValue({ user: AUTH_USER });
    mockUseGameSocket.mockReturnValue({ snapshot: null, connectionError: null, sendAction: vi.fn() });

    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText(/connecting…/i)).toBeInTheDocument());
    expect(mockUseGameSocket).toHaveBeenLastCalledWith('admin', true);
  });

  it('shows a pending-approval message when login fails because the account is pending', async () => {
    const user = userEvent.setup();
    mockUseGameSocket.mockReturnValue({ snapshot: null, connectionError: null, sendAction: vi.fn() });
    mockLogin.mockRejectedValue(new AuthApiError('Your account is awaiting admin approval', 401));
    render(<AdminPage />);

    await waitFor(() => screen.getByLabelText(/username/i));
    await user.type(screen.getByLabelText(/username/i), 'alice');
    await user.type(screen.getByLabelText(/^password$/i), 'hunter2');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/awaiting admin approval/i),
    );
  });

  it('surfaces a connection error before the first snapshot arrives', async () => {
    mockFetchMe.mockReset();
    mockFetchMe.mockResolvedValue({ user: AUTH_USER });
    mockUseGameSocket.mockReturnValue({
      snapshot: null,
      connectionError: 'Invalid or expired session',
      sendAction: vi.fn(),
    });

    render(<AdminPage />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid or expired session/i),
    );
  });

  it('surfaces a connection error as an alert once connected', async () => {
    mockFetchMe.mockReset();
    mockFetchMe.mockResolvedValue({ user: AUTH_USER });
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress(), currentQuestion: null },
      connectionError: 'Only admin clients may perform game actions',
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/only admin clients/i),
    );
  });
});
