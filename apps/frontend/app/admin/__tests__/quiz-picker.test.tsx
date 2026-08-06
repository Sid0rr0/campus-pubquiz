import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameProgress } from '@campus-pubquiz/types';
import AdminPage from '@/app/admin/page';
import { authenticatedAuthResult, progress } from './test-utils';

const { mockUseGameSocket, mockFetchQuizzes, mockUseAuth, searchParamsRef } = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  mockFetchQuizzes: vi.fn(),
  mockUseAuth: vi.fn(),
  searchParamsRef: { current: new URLSearchParams('code=TESTCODE') },
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('@/app/lib/quiz-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/quiz-api')>();
  return { ...actual, fetchQuizzes: mockFetchQuizzes };
});

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('AdminPage — quiz picker', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams('code=TESTCODE');
    mockUseGameSocket.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockFetchQuizzes.mockReset();
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
  });

  it('links to the quiz editor while the game is in the lobby or ended', async () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null, joinCode: 'TESTCODE' },
      connectionError: null,
      sendAction: vi.fn(),
      selectQuiz: vi.fn(),
    });
    render(<AdminPage />);

    expect(await screen.findByRole('link', { name: /create or edit a quiz/i })).toHaveAttribute(
      'href',
      '/quizzes/new',
    );
  });

  it('requests the quiz list while the game is in the lobby or ended', async () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'ended' }), currentQuestion: null, joinCode: 'TESTCODE' },
      connectionError: null,
      sendAction: vi.fn(),
      selectQuiz: vi.fn(),
    });
    render(<AdminPage />);

    await waitFor(() => expect(mockFetchQuizzes).toHaveBeenCalled());
  });

  it('refreshes the quiz list when the admin returns from ended to lobby', async () => {
    let status: GameProgress['status'] = 'ended';

    mockUseGameSocket.mockImplementation(() => ({
      snapshot: { progress: progress({ status }), currentQuestion: null, joinCode: 'TESTCODE' },
      connectionError: null,
      sendAction: vi.fn(),
      selectQuiz: vi.fn(),
    }));

    const { rerender } = render(<AdminPage />);
    await waitFor(() => expect(mockFetchQuizzes).toHaveBeenCalledTimes(1));

    status = 'lobby';
    rerender(<AdminPage />);

    await waitFor(() => expect(mockFetchQuizzes).toHaveBeenCalledTimes(2));
  });

  it('shows quiz selection after the game has ended', async () => {
    const selectQuiz = vi.fn();
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 'quiz-1',
      quizzes: [
        { id: 'quiz-1', title: 'Spring Quiz', rounds: [] },
        { id: 'quiz-2', title: 'Summer Quiz', rounds: [] },
      ],
    });
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'ended' }), currentQuestion: null, joinCode: 'TESTCODE' },
      connectionError: null,
      sendAction: vi.fn(),
      selectQuiz,
    });

    render(<AdminPage />);

    expect(await screen.findByRole('heading', { name: /choose new quiz/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select quiz summer quiz/i })).toBeInTheDocument();
  });

  it('lists available quizzes in the lobby with the active quiz marked', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 'quiz-1',
      quizzes: [
        { id: 'quiz-1', title: 'Campus Pub Quiz Night', rounds: [] },
        { id: 'quiz-2', title: 'Imported Quiz', rounds: [] },
      ],
    });
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null, joinCode: 'TESTCODE' },
      connectionError: null,
      sendAction: vi.fn(),
      selectQuiz: vi.fn(),
    });
    render(<AdminPage />);

    expect(await screen.findByText('Campus Pub Quiz Night')).toBeInTheDocument();
    expect(screen.getByText('Imported Quiz')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restart quiz campus pub quiz night/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /select quiz imported quiz/i })).toBeEnabled();
  });

  it('does not call selectQuiz until the quiz choice is confirmed', async () => {
    const selectQuiz = vi.fn();
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 'quiz-1',
      quizzes: [
        { id: 'quiz-1', title: 'Campus Pub Quiz Night', rounds: [] },
        { id: 'quiz-2', title: 'Imported Quiz', rounds: [] },
      ],
    });
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null, joinCode: 'TESTCODE' },
      connectionError: null,
      sendAction: vi.fn(),
      selectQuiz,
    });
    render(<AdminPage />);

    await userEvent.click(await screen.findByRole('button', { name: /select quiz imported quiz/i }));

    expect(selectQuiz).not.toHaveBeenCalled();
    expect(screen.getByText(/start "imported quiz"\?/i)).toBeInTheDocument();
  });

  it('marks the clicked quiz as selected while awaiting confirmation', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 'quiz-1',
      quizzes: [
        { id: 'quiz-1', title: 'Campus Pub Quiz Night', rounds: [] },
        { id: 'quiz-2', title: 'Imported Quiz', rounds: [] },
      ],
    });
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null, joinCode: 'TESTCODE' },
      connectionError: null,
      sendAction: vi.fn(),
      selectQuiz: vi.fn(),
    });
    render(<AdminPage />);

    await userEvent.click(await screen.findByRole('button', { name: /select quiz imported quiz/i }));

    expect(
      screen.getByRole('button', { name: /imported quiz selected, awaiting confirmation/i }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows the rounds and questions for the quiz selected in the picker', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 'quiz-1',
      quizzes: [
        { id: 'quiz-1', title: 'Campus Pub Quiz Night', rounds: [] },
        {
          id: 'quiz-2',
          title: 'Imported Quiz',
          rounds: [
            {
              title: 'Round 1',
              breakAfter: false,
              questions: [{ id: 'q-1', prompt: 'Name a fruit', answer: 'Banana' }],
            },
          ],
        },
      ],
    });
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null, joinCode: 'TESTCODE' },
      connectionError: null,
      sendAction: vi.fn(),
      selectQuiz: vi.fn(),
    });
    render(<AdminPage />);

    expect(screen.queryByText('Name a fruit')).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: /select quiz imported quiz/i }));

    expect(screen.getByText('Round 1')).toBeInTheDocument();
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('shows a question\'s options and correct answer once its quiz is selected', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 'quiz-1',
      quizzes: [
        { id: 'quiz-1', title: 'Campus Pub Quiz Night', rounds: [] },
        {
          id: 'quiz-2',
          title: 'Imported Quiz',
          rounds: [
            {
              title: 'Round 1',
              breakAfter: false,
              questions: [
                {
                  id: 'q-1',
                  prompt: 'Capital of France?',
                  options: ['Paris', 'London', 'Berlin'],
                  answer: 'Paris',
                },
              ],
            },
          ],
        },
      ],
    });
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null, joinCode: 'TESTCODE' },
      connectionError: null,
      sendAction: vi.fn(),
      selectQuiz: vi.fn(),
    });
    render(<AdminPage />);

    await userEvent.click(await screen.findByRole('button', { name: /select quiz imported quiz/i }));

    expect(screen.getByText(/options: paris, london, berlin/i)).toBeInTheDocument();
    expect(screen.getByText(/answer: paris/i)).toBeInTheDocument();
  });

  it('restarts the current quiz once restarting it is confirmed', async () => {
    const selectQuiz = vi.fn();
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 'quiz-1',
      quizzes: [
        { id: 'quiz-1', title: 'Campus Pub Quiz Night', rounds: [] },
        { id: 'quiz-2', title: 'Imported Quiz', rounds: [] },
      ],
    });
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'ended' }), currentQuestion: null, joinCode: 'TESTCODE' },
      connectionError: null,
      sendAction: vi.fn(),
      selectQuiz,
    });

    render(<AdminPage />);

    await userEvent.click(
      await screen.findByRole('button', { name: /restart quiz campus pub quiz night/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    expect(selectQuiz).toHaveBeenCalledWith('quiz-1');
  });

  it('selects a different quiz once the selection is confirmed', async () => {
    const selectQuiz = vi.fn();
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 'quiz-1',
      quizzes: [
        { id: 'quiz-1', title: 'Campus Pub Quiz Night', rounds: [] },
        { id: 'quiz-2', title: 'Imported Quiz', rounds: [] },
      ],
    });
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null, joinCode: 'TESTCODE' },
      connectionError: null,
      sendAction: vi.fn(),
      selectQuiz,
    });
    render(<AdminPage />);

    await userEvent.click(await screen.findByRole('button', { name: /select quiz imported quiz/i }));
    await userEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    expect(selectQuiz).toHaveBeenCalledWith('quiz-2');
  });

  it('clears the pending selection when cancel is clicked', async () => {
    const selectQuiz = vi.fn();
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 'quiz-1',
      quizzes: [
        { id: 'quiz-1', title: 'Campus Pub Quiz Night', rounds: [] },
        { id: 'quiz-2', title: 'Imported Quiz', rounds: [] },
      ],
    });
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null, joinCode: 'TESTCODE' },
      connectionError: null,
      sendAction: vi.fn(),
      selectQuiz,
    });
    render(<AdminPage />);

    await userEvent.click(await screen.findByRole('button', { name: /select quiz imported quiz/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByText(/start "imported quiz"\?/i)).not.toBeInTheDocument();
    expect(selectQuiz).not.toHaveBeenCalled();
  });

  it('shows the active quiz name in the left panel', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 'quiz-1',
      quizzes: [
        { id: 'quiz-1', title: 'Campus Pub Quiz Night', rounds: [] },
        { id: 'quiz-2', title: 'Imported Quiz', rounds: [] },
      ],
    });
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null, joinCode: 'TESTCODE' },
      connectionError: null,
      sendAction: vi.fn(),
      selectQuiz: vi.fn(),
    });
    render(<AdminPage />);

    const sidebar = screen.getByRole('complementary');
    await waitFor(() => expect(sidebar).toHaveTextContent(/quiz: campus pub quiz night/i));
  });

  it('hides the quiz picker once the game has left the lobby', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 'quiz-1',
      quizzes: [
        { id: 'quiz-1', title: 'Campus Pub Quiz Night', rounds: [] },
        { id: 'quiz-2', title: 'Imported Quiz', rounds: [] },
      ],
    });
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
        joinCode: 'TESTCODE',
      },
      connectionError: null,
      sendAction: vi.fn(),
      selectQuiz: vi.fn(),
    });
    render(<AdminPage />);

    await waitFor(() => expect(mockFetchQuizzes).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /select quiz/i })).not.toBeInTheDocument();
  });
});
