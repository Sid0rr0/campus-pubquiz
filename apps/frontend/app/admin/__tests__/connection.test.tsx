import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/admin/page';
import { progress } from './test-utils';

const { mockUseGameSocket, mockFetchQuizzes } = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  mockFetchQuizzes: vi.fn(),
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('@/app/lib/quiz-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/quiz-api')>();
  return { ...actual, fetchQuizzes: mockFetchQuizzes };
});

describe('AdminPage — connection', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseGameSocket.mockReset();
    mockFetchQuizzes.mockReset();
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
  });

  it('shows the admin password form before connecting', () => {
    mockUseGameSocket.mockReturnValue({ snapshot: null, connectionError: null, sendAction: vi.fn() });
    render(<AdminPage />);

    expect(screen.getByLabelText(/admin password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
  });

  it('shows an admin password field before connecting', () => {
    mockUseGameSocket.mockReturnValue({ snapshot: null, connectionError: null, sendAction: vi.fn() });
    render(<AdminPage />);

    expect(screen.getByLabelText(/admin password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
  });

  it('submits the typed password into the socket hook when connect is clicked', async () => {
    const user = userEvent.setup();
    mockUseGameSocket.mockReturnValue({ snapshot: null, connectionError: null, sendAction: vi.fn() });
    render(<AdminPage />);

    await user.type(screen.getByLabelText(/admin password/i), 'secret-pass');
    await user.click(screen.getByRole('button', { name: /connect/i }));

    expect(window.localStorage.getItem('campus-pubquiz-admin-password')).toBe('secret-pass');
    expect(mockUseGameSocket).toHaveBeenLastCalledWith('admin', 'secret-pass', true);
  });

  it('restores the stored admin password after a refresh and reconnects automatically', async () => {
    window.localStorage.setItem('campus-pubquiz-admin-password', 'secret-pass');
    mockUseGameSocket.mockReturnValue({ snapshot: null, connectionError: null, sendAction: vi.fn() });

    render(<AdminPage />);

    expect(screen.queryByLabelText(/admin password/i)).not.toBeInTheDocument();
    expect(screen.getByText(/connecting…/i)).toBeInTheDocument();
    expect(mockUseGameSocket).toHaveBeenLastCalledWith('admin', 'secret-pass', true);
  });

  it('surfaces a connection error before the first snapshot arrives', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: null,
      connectionError: 'Invalid admin password',
      sendAction: vi.fn(),
    });

    render(<AdminPage />);

    expect(screen.getByRole('alert')).toHaveTextContent(/invalid admin password/i);
  });

  it('surfaces a connection error as an alert', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress(), currentQuestion: null },
      connectionError: 'Only admin clients may perform game actions',
      sendAction: vi.fn(),
    });
    render(<AdminPage />);
    expect(screen.getByRole('alert')).toHaveTextContent(/only admin clients/i);
  });
});
