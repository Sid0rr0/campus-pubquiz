import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionPickerPanel } from '@/app/sessions/session-picker-panel';

const {
  mockFetchSessions,
  mockCreateSession,
  mockCloseSession,
  mockFetchQuizzes,
} = vi.hoisted(() => ({
  mockFetchSessions: vi.fn(),
  mockCreateSession: vi.fn(),
  mockCloseSession: vi.fn(),
  mockFetchQuizzes: vi.fn(),
}));

vi.mock('@/app/lib/sessions-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/lib/sessions-api')>();
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

    expect(
      await screen.findByText(/no sessions running yet/i),
    ).toBeInTheDocument();
  });

  it('lists running sessions with their quiz title, status and team count', async () => {
    mockFetchSessions.mockResolvedValue([
      {
        joinCode: 'ABCDEF',
        quizId: 1,
        quizTitle: 'Campus Pub Quiz Night',
        status: 'lobby',
        teamCount: 3,
      },
    ]);
    render(<SessionPickerPanel onOpenSession={vi.fn()} />);

    expect(
      await screen.findByText('Campus Pub Quiz Night'),
    ).toBeInTheDocument();
    expect(screen.getByText(/lobby · 3 teams · abcdef/i)).toBeInTheDocument();
  });

  it('opens a session when its Open button is clicked', async () => {
    mockFetchSessions.mockResolvedValue([
      {
        joinCode: 'ABCDEF',
        quizId: 1,
        quizTitle: 'Campus Pub Quiz Night',
        status: 'lobby',
        teamCount: 0,
      },
    ]);
    const onOpenSession = vi.fn();
    render(<SessionPickerPanel onOpenSession={onOpenSession} />);

    await userEvent.click(await screen.findByRole('button', { name: /open/i }));

    expect(onOpenSession).toHaveBeenCalledWith('ABCDEF');
  });

  it('shows a Close button only for ended sessions and closes then refreshes the list', async () => {
    mockFetchSessions
      .mockResolvedValueOnce([
        {
          joinCode: 'AAAAAA',
          quizId: 1,
          quizTitle: 'Live Quiz',
          status: 'question_open',
          teamCount: 1,
        },
        {
          joinCode: 'BBBBBB',
          quizId: 2,
          quizTitle: 'Finished Quiz',
          status: 'ended',
          teamCount: 2,
        },
      ])
      .mockResolvedValueOnce([
        {
          joinCode: 'AAAAAA',
          quizId: 1,
          quizTitle: 'Live Quiz',
          status: 'question_open',
          teamCount: 1,
        },
      ]);
    mockCloseSession.mockResolvedValue(undefined);
    render(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await screen.findByText('Live Quiz');
    expect(screen.getAllByRole('button', { name: /^close$/i })).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: /^close$/i }));

    expect(mockCloseSession).toHaveBeenCalledWith('BBBBBB');
    await waitFor(() =>
      expect(screen.queryByText('Finished Quiz')).not.toBeInTheDocument(),
    );
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

    expect(await screen.findByText(/imported quiz/i)).toBeInTheDocument();
  });

  it('links to the quiz editor to create a new quiz', () => {
    render(<SessionPickerPanel onOpenSession={vi.fn()} />);

    expect(screen.getByRole('link', { name: /new quiz/i })).toHaveAttribute(
      'href',
      '/quizzes/new',
    );
  });

  it('links each listed quiz to its editor', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [{ id: 2, title: 'Imported Quiz', rounds: [] }],
    });
    render(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await screen.findByText(/imported quiz/i);
    expect(screen.getByRole('link', { name: /edit/i })).toHaveAttribute(
      'href',
      '/quizzes/2',
    );
  });

  it('shows a confirmation modal with the quiz rounds and questions before creating a session', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [
        {
          id: 2,
          title: 'Imported Quiz',
          rounds: [
            {
              title: 'Round 1',
              breakAfter: false,
              questions: [
                {
                  id: 1,
                  type: 'free_text',
                  prompt: 'Name a fruit',
                  answer: 'Banana',
                },
              ],
            },
          ],
        },
      ],
    });
    render(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole('button', { name: /^start$/i }),
    );

    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: /start "imported quiz"\?/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Round 1')).toBeInTheDocument();
    expect(screen.getByText('(free_text) Name a fruit')).toBeInTheDocument();
  });

  it('creates a new session for the chosen quiz and opens it once confirmed', async () => {
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

    await userEvent.click(
      await screen.findByRole('button', { name: /^start$/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    expect(mockCreateSession).toHaveBeenCalledWith(2);
    await waitFor(() => expect(onOpenSession).toHaveBeenCalledWith('GHIJKL'));
  });

  it('does not create a session when the confirmation modal is cancelled', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [{ id: 2, title: 'Imported Quiz', rounds: [] }],
    });
    render(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole('button', { name: /^start$/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('heading', { name: /start "imported quiz"\?/i }),
    ).not.toBeInTheDocument();
  });

  it('shows an error when the session list cannot be loaded', async () => {
    mockFetchSessions.mockRejectedValue(new Error('network down'));
    render(<SessionPickerPanel onOpenSession={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not load sessions/i,
    );
  });

  it('shows an error when creating a session fails', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [{ id: 2, title: 'Imported Quiz', rounds: [] }],
    });
    const { SessionApiError } = await import('@/app/lib/sessions-api');
    mockCreateSession.mockRejectedValue(
      new SessionApiError('Could not start session', 500),
    );
    render(
      <>
        <SessionPickerPanel onOpenSession={vi.fn()} />
        <Toaster />
      </>,
    );

    await userEvent.click(
      await screen.findByRole('button', { name: /^start$/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    expect(
      await screen.findByText(/could not start session/i),
    ).toBeInTheDocument();
  });
});
