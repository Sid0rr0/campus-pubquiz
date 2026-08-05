import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionPickerPanel } from '@/app/admin/session-picker-panel';

const { mockFetchSessions, mockCreateSession, mockCloseSession, mockFetchQuizzes } = vi.hoisted(() => ({
  mockFetchSessions: vi.fn(),
  mockCreateSession: vi.fn(),
  mockCloseSession: vi.fn(),
  mockFetchQuizzes: vi.fn(),
}));

vi.mock('@/app/lib/sessions-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/sessions-api')>();
  return {
    ...actual,
    fetchSessions: mockFetchSessions,
    createSession: mockCreateSession,
    closeSession: mockCloseSession,
  };
});

vi.mock('@/app/lib/quiz-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/quiz-api')>();
  return { ...actual, fetchQuizzes: mockFetchQuizzes };
});

describe('SessionPickerPanel', () => {
  beforeEach(() => {
    mockFetchSessions.mockReset();
    mockCreateSession.mockReset();
    mockCloseSession.mockReset();
    mockFetchQuizzes.mockReset();
    mockFetchSessions.mockResolvedValue([]);
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
  });

  it('shows a message when no sessions are running', async () => {
    render(<SessionPickerPanel onOpenSession={vi.fn()} />);

    expect(await screen.findByText(/no sessions running yet/i)).toBeInTheDocument();
  });

  it('lists running sessions with their quiz title, status and team count', async () => {
    mockFetchSessions.mockResolvedValue([
      { joinCode: 'ABCDEF', quizId: 1, quizTitle: 'Campus Pub Quiz Night', status: 'lobby', teamCount: 3 },
    ]);
    render(<SessionPickerPanel onOpenSession={vi.fn()} />);

    expect(await screen.findByText('Campus Pub Quiz Night')).toBeInTheDocument();
    expect(screen.getByText(/lobby · 3 teams · abcdef/i)).toBeInTheDocument();
  });

  it('opens a session when its Open button is clicked', async () => {
    mockFetchSessions.mockResolvedValue([
      { joinCode: 'ABCDEF', quizId: 1, quizTitle: 'Campus Pub Quiz Night', status: 'lobby', teamCount: 0 },
    ]);
    const onOpenSession = vi.fn();
    render(<SessionPickerPanel onOpenSession={onOpenSession} />);

    await userEvent.click(await screen.findByRole('button', { name: /open/i }));

    expect(onOpenSession).toHaveBeenCalledWith('ABCDEF');
  });

  it('shows a Close button only for ended sessions and closes then refreshes the list', async () => {
    mockFetchSessions
      .mockResolvedValueOnce([
        { joinCode: 'AAAAAA', quizId: 1, quizTitle: 'Live Quiz', status: 'question_open', teamCount: 1 },
        { joinCode: 'BBBBBB', quizId: 2, quizTitle: 'Finished Quiz', status: 'ended', teamCount: 2 },
      ])
      .mockResolvedValueOnce([
        { joinCode: 'AAAAAA', quizId: 1, quizTitle: 'Live Quiz', status: 'question_open', teamCount: 1 },
      ]);
    mockCloseSession.mockResolvedValue(undefined);
    render(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await screen.findByText('Live Quiz');
    expect(screen.getAllByRole('button', { name: /^close$/i })).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: /^close$/i }));

    expect(mockCloseSession).toHaveBeenCalledWith('BBBBBB');
    await waitFor(() => expect(screen.queryByText('Finished Quiz')).not.toBeInTheDocument());
  });

  it('lists quizzes available to start a new session', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 1,
      quizzes: [
        { id: 1, title: 'Campus Pub Quiz Night', rounds: [] },
        { id: 2, title: 'Imported Quiz', rounds: [] },
      ],
    });
    render(<SessionPickerPanel onOpenSession={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'Imported Quiz' })).toBeInTheDocument();
  });

  it('creates a new session for the chosen quiz and opens it', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [{ id: 2, title: 'Imported Quiz', rounds: [] }],
    });
    mockCreateSession.mockResolvedValue({
      joinCode: 'GHIJKL',
      quizId: 2,
      quizTitle: 'Imported Quiz',
      status: 'lobby',
      teamCount: 0,
    });
    const onOpenSession = vi.fn();
    render(<SessionPickerPanel onOpenSession={onOpenSession} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Imported Quiz' }));

    expect(mockCreateSession).toHaveBeenCalledWith(2);
    await waitFor(() => expect(onOpenSession).toHaveBeenCalledWith('GHIJKL'));
  });

  it('shows an error when the session list cannot be loaded', async () => {
    mockFetchSessions.mockRejectedValue(new Error('network down'));
    render(<SessionPickerPanel onOpenSession={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load sessions/i);
  });

  it('shows an error when creating a session fails', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [{ id: 2, title: 'Imported Quiz', rounds: [] }],
    });
    const { SessionApiError } = await import('@/app/lib/sessions-api');
    mockCreateSession.mockRejectedValue(new SessionApiError('Could not start session', 500));
    render(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Imported Quiz' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not start session/i);
  });
});
