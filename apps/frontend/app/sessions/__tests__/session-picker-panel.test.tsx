import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SESSION_SETTINGS, type AuthUser } from '@campus-pubquiz/types';
import { SessionPickerPanel } from '@/app/sessions/session-picker-panel';
import type { UseAuthResult } from '@/app/lib/use-auth';
import { renderWithQuery } from '@/test-utils/query';

const {
  mockFetchSessions,
  mockCreateSession,
  mockCloseSession,
  mockFetchQuizzes,
  mockDeleteQuiz,
  mockUseAuth,
} = vi.hoisted(() => ({
  mockFetchSessions: vi.fn(),
  mockCreateSession: vi.fn(),
  mockCloseSession: vi.fn(),
  mockFetchQuizzes: vi.fn(),
  mockDeleteQuiz: vi.fn(),
  mockUseAuth: vi.fn(),
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
  return {
    ...actual,
    fetchQuizzes: mockFetchQuizzes,
    deleteQuiz: mockDeleteQuiz,
  };
});

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

const ADMIN_USER: AuthUser = {
  id: 1,
  username: 'admin',
  role: 'admin',
  status: 'active',
};

const MODERATOR_USER: AuthUser = {
  id: 2,
  username: 'moderator',
  role: 'moderator',
  status: 'active',
};

function authResult(overrides: Partial<UseAuthResult> = {}): UseAuthResult {
  return {
    user: ADMIN_USER,
    status: 'authenticated',
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

describe('SessionPickerPanel', () => {
  beforeEach(() => {
    mockFetchSessions.mockReset();
    mockCreateSession.mockReset();
    mockCloseSession.mockReset();
    mockFetchQuizzes.mockReset();
    mockDeleteQuiz.mockReset();
    mockUseAuth.mockReset();
    mockFetchSessions.mockResolvedValue([]);
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
    mockUseAuth.mockReturnValue(authResult());
  });

  it('shows a message when no sessions are running', async () => {
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

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
        name: 'Campus Pub Quiz Night',
        status: 'lobby',
        teamCount: 3,
        startedAt: '2026-09-16T12:00:00.000Z',
      },
    ]);
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

    expect(
      await screen.findByText('Campus Pub Quiz Night'),
    ).toBeInTheDocument();
    expect(screen.getByText(/lobby · 3 teams · abcdef/i)).toBeInTheDocument();
  });

  it('shows when each running session was started', async () => {
    mockFetchSessions.mockResolvedValue([
      {
        joinCode: 'ABCDEF',
        quizId: 1,
        quizTitle: 'Campus Pub Quiz Night',
        name: 'Campus Pub Quiz Night',
        status: 'lobby',
        teamCount: 3,
        startedAt: '2026-09-16T12:00:00.000Z',
      },
    ]);
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await screen.findByText('Campus Pub Quiz Night');
    expect(
      screen.getByText(
        new RegExp(
          `started ${new Date('2026-09-16T12:00:00.000Z').toLocaleString()}`,
          'i',
        ),
      ),
    ).toBeInTheDocument();
  });

  it('opens a session when its Control button is clicked', async () => {
    mockFetchSessions.mockResolvedValue([
      {
        joinCode: 'ABCDEF',
        quizId: 1,
        quizTitle: 'Campus Pub Quiz Night',
        name: 'Campus Pub Quiz Night',
        status: 'lobby',
        teamCount: 0,
      },
    ]);
    const onOpenSession = vi.fn();
    renderWithQuery(<SessionPickerPanel onOpenSession={onOpenSession} />);

    await userEvent.click(
      await screen.findByRole('button', { name: /control/i }),
    );

    expect(onOpenSession).toHaveBeenCalledWith('ABCDEF');
  });

  it('links each running session to its /remote view in a new tab', async () => {
    mockFetchSessions.mockResolvedValue([
      {
        joinCode: 'ABCDEF',
        quizId: 1,
        quizTitle: 'Campus Pub Quiz Night',
        name: 'Campus Pub Quiz Night',
        status: 'lobby',
        teamCount: 0,
      },
    ]);
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

    const remoteLink = await screen.findByRole('link', { name: /remote/i });
    expect(remoteLink).toHaveAttribute('href', '/remote?code=ABCDEF');
    expect(remoteLink).toHaveAttribute('target', '_blank');
  });

  it('shows a Close button only for ended sessions and closes then refreshes the list', async () => {
    mockFetchSessions
      .mockResolvedValueOnce([
        {
          joinCode: 'AAAAAA',
          quizId: 1,
          quizTitle: 'Live Quiz',
          name: 'Live Quiz',
          status: 'question_open',
          teamCount: 1,
        },
        {
          joinCode: 'BBBBBB',
          quizId: 2,
          quizTitle: 'Finished Quiz',
          name: 'Finished Quiz',
          status: 'ended',
          teamCount: 2,
        },
      ])
      .mockResolvedValueOnce([
        {
          joinCode: 'AAAAAA',
          quizId: 1,
          quizTitle: 'Live Quiz',
          name: 'Live Quiz',
          status: 'question_open',
          teamCount: 1,
        },
      ]);
    mockCloseSession.mockResolvedValue(undefined);
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

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
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

    expect(await screen.findByText(/imported quiz/i)).toBeInTheDocument();
  });

  it('links to the quiz editor to create a new quiz', () => {
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

    expect(screen.getByRole('link', { name: /new quiz/i })).toHaveAttribute(
      'href',
      '/quizzes/new',
    );
  });

  it('links each listed quiz to its editor from the actions menu', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [{ id: 2, title: 'Imported Quiz', rounds: [] }],
    });
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await screen.findByText(/imported quiz/i);
    await userEvent.click(
      screen.getByRole('button', { name: /actions for imported quiz/i }),
    );

    expect(
      await screen.findByRole('menuitem', { name: /edit/i }),
    ).toHaveAttribute('href', '/quizzes/2');
  });

  it("shows the quiz's last-edited date and time", async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [
        {
          id: 2,
          title: 'Imported Quiz',
          updatedAt: '2026-09-16T14:32:00.000Z',
          rounds: [],
        },
      ],
    });
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await screen.findByText(/imported quiz/i);
    expect(
      screen.getByText(new Date('2026-09-16T14:32:00.000Z').toLocaleString()),
    ).toBeInTheDocument();
  });

  it('shows Delete in the actions menu for an admin and deletes the quiz on confirm', async () => {
    mockUseAuth.mockReturnValue(authResult({ user: ADMIN_USER }));
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [{ id: 2, title: 'Imported Quiz', rounds: [] }],
    });
    mockDeleteQuiz.mockResolvedValue(undefined);
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await screen.findByText(/imported quiz/i);
    await userEvent.click(
      screen.getByRole('button', { name: /actions for imported quiz/i }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: /delete/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(mockDeleteQuiz).toHaveBeenCalledWith(2));
  });

  it('shows a success toast naming the quiz after it is deleted', async () => {
    mockUseAuth.mockReturnValue(authResult({ user: ADMIN_USER }));
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [{ id: 2, title: 'Imported Quiz', rounds: [] }],
    });
    mockDeleteQuiz.mockResolvedValue(undefined);
    renderWithQuery(
      <>
        <SessionPickerPanel onOpenSession={vi.fn()} />
        <Toaster />
      </>,
    );

    await screen.findByText(/imported quiz/i);
    await userEvent.click(
      screen.getByRole('button', { name: /actions for imported quiz/i }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: /delete/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(
      await screen.findByText('Deleted "Imported Quiz"'),
    ).toBeInTheDocument();
  });

  it('hides Delete from the actions menu for a non-admin', async () => {
    mockUseAuth.mockReturnValue(authResult({ user: MODERATOR_USER }));
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [{ id: 2, title: 'Imported Quiz', rounds: [] }],
    });
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await screen.findByText(/imported quiz/i);
    await userEvent.click(
      screen.getByRole('button', { name: /actions for imported quiz/i }),
    );

    expect(
      screen.queryByRole('menuitem', { name: /delete/i }),
    ).not.toBeInTheDocument();
  });

  it('defaults the quiz table to most-recently-edited first', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [
        {
          id: 1,
          title: 'Older Quiz',
          updatedAt: '2020-01-01T00:00:00.000Z',
          rounds: [],
        },
        {
          id: 2,
          title: 'Newer Quiz',
          updatedAt: '2026-01-01T00:00:00.000Z',
          rounds: [],
        },
      ],
    });
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await screen.findByText(/older quiz/i);
    const [firstRow] = screen.getAllByRole('row').slice(1);

    expect(firstRow.textContent).toContain('Newer Quiz');
  });

  it('sorts the quiz table by name when the Quiz header is clicked', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [
        { id: 1, title: 'Zebra Quiz', rounds: [] },
        { id: 2, title: 'Alpha Quiz', rounds: [] },
      ],
    });
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await screen.findByText(/zebra quiz/i);
    function rowTitles(): string[] {
      return screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent ?? '');
    }

    await userEvent.click(screen.getByRole('button', { name: /^quiz$/i }));
    const afterFirstClick = rowTitles();
    await userEvent.click(screen.getByRole('button', { name: /^quiz$/i }));
    const afterSecondClick = rowTitles();

    expect(afterFirstClick).not.toEqual(afterSecondClick);
    expect(afterFirstClick).toEqual([...afterSecondClick].reverse());
  });

  it('sorts the quiz table by edited date when the Edited header is clicked', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [
        {
          id: 1,
          title: 'Older Quiz',
          updatedAt: '2020-01-01T00:00:00.000Z',
          rounds: [],
        },
        {
          id: 2,
          title: 'Newer Quiz',
          updatedAt: '2026-01-01T00:00:00.000Z',
          rounds: [],
        },
      ],
    });
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await screen.findByText(/older quiz/i);
    function rowTitles(): string[] {
      return screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent ?? '');
    }

    await userEvent.click(screen.getByRole('button', { name: /^edited$/i }));
    const afterFirstClick = rowTitles();
    await userEvent.click(screen.getByRole('button', { name: /^edited$/i }));
    const afterSecondClick = rowTitles();

    expect(afterFirstClick).not.toEqual(afterSecondClick);
    expect(afterFirstClick).toEqual([...afterSecondClick].reverse());
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
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

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

  it('splits the confirm dialog into an Overview tab (rounds) and a Settings tab', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [{ id: 2, title: 'Imported Quiz', rounds: [] }],
    });
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole('button', { name: /^start$/i }),
    );

    expect(
      screen.getByRole('tab', { name: /overview/i, selected: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /settings/i })).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/lock round after/i),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /settings/i }));

    expect(screen.getByLabelText(/lock round after/i)).toBeInTheDocument();
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
    renderWithQuery(<SessionPickerPanel onOpenSession={onOpenSession} />);

    await userEvent.click(
      await screen.findByRole('button', { name: /^start$/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    expect(mockCreateSession).toHaveBeenCalledWith(
      2,
      DEFAULT_SESSION_SETTINGS,
      'Imported Quiz',
    );
    await waitFor(() => expect(onOpenSession).toHaveBeenCalledWith('GHIJKL'));
  });

  it('defaults the session name input to the quiz title', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [{ id: 2, title: 'Imported Quiz', rounds: [] }],
    });
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole('button', { name: /^start$/i }),
    );

    expect(screen.getByLabelText(/session name/i)).toHaveValue('Imported Quiz');
  });

  it('passes an edited session name through to createSession', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [{ id: 2, title: 'Imported Quiz', rounds: [] }],
    });
    mockCreateSession.mockResolvedValue({
      joinCode: 'GHIJKL',
      quizId: 2,
      quizTitle: 'Imported Quiz',
      name: 'Week 3 Social',
      status: 'lobby',
      teamCount: 0,
    });
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole('button', { name: /^start$/i }),
    );
    const nameInput = screen.getByLabelText(/session name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Week 3 Social');
    await userEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    expect(mockCreateSession).toHaveBeenCalledWith(
      2,
      DEFAULT_SESSION_SETTINGS,
      'Week 3 Social',
    );
  });

  it('passes the confirm dialog form edits through to createSession', async () => {
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
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole('button', { name: /^start$/i }),
    );
    await userEvent.click(screen.getByRole('tab', { name: /settings/i }));
    const lockGraceInput = screen.getByLabelText(/lock round after/i);
    await userEvent.clear(lockGraceInput);
    await userEvent.type(lockGraceInput, '15');
    await userEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    expect(mockCreateSession).toHaveBeenCalledWith(
      2,
      { ...DEFAULT_SESSION_SETTINGS, lockGraceSeconds: 15 },
      'Imported Quiz',
    );
  });

  it('prefills the kahoot question timer to 30s for a quiz with a kahootMode round', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [
        {
          id: 2,
          title: 'Speed Quiz',
          rounds: [
            {
              title: 'Speed Round',
              breakAfter: false,
              kahootMode: true,
              questions: [],
            },
          ],
        },
      ],
    });
    mockCreateSession.mockResolvedValue({
      joinCode: 'GHIJKL',
      quizId: 2,
      quizTitle: 'Speed Quiz',
      status: 'lobby',
      teamCount: 0,
    });
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole('button', { name: /^start$/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    expect(mockCreateSession).toHaveBeenCalledWith(
      2,
      { ...DEFAULT_SESSION_SETTINGS, kahootQuestionTimerSeconds: 30 },
      'Speed Quiz',
    );
  });

  it('prefills the kahoot question timer to null for a quiz with no kahootMode round', async () => {
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
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole('button', { name: /^start$/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    expect(mockCreateSession).toHaveBeenCalledWith(
      2,
      DEFAULT_SESSION_SETTINGS,
      'Imported Quiz',
    );
  });

  it('does not create a session when the confirmation modal is cancelled', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: null,
      quizzes: [{ id: 2, title: 'Imported Quiz', rounds: [] }],
    });
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

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
    renderWithQuery(<SessionPickerPanel onOpenSession={vi.fn()} />);

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
    renderWithQuery(
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
