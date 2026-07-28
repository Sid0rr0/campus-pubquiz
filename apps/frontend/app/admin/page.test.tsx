import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameProgress } from '@campus-pubquiz/types';
import AdminPage from '@/app/admin/page';

const { mockUseGameSocket } = vi.hoisted(() => ({ mockUseGameSocket: vi.fn() }));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

function progress(overrides: Partial<GameProgress> = {}): GameProgress {
  return {
    status: 'lobby',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
    ...overrides,
  };
}

describe('AdminPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseGameSocket.mockReset();
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

  it('shows the current status and question once connected', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);
    expect(screen.getByText(/question_open/i)).toBeInTheDocument();
    expect(screen.getByText(/name a fruit/i)).toBeInTheDocument();
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

  it('lists the connected team names in the sidebar', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'lobby' }),
        currentQuestion: null,
        teams: [
          { teamId: 'team-1', teamName: 'The Quizzards' },
          { teamId: 'team-2', teamName: 'Beer Necessities' },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    const sidebar = screen.getByRole('complementary');
    expect(sidebar).toHaveTextContent(/teams \(2\)/i);
    expect(sidebar).toHaveTextContent('The Quizzards');
    expect(sidebar).toHaveTextContent('Beer Necessities');
  });

  it('sends START_QUIZ when the Start Quiz button is clicked', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /start quiz/i }));

    expect(sendAction).toHaveBeenCalledWith('START_QUIZ');
  });

  it('sends ADVANCE when the Advance button is clicked', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'question_open' }), currentQuestion: null },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /advance/i }));

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });

  it('hides the Previous button on the very first question of the quiz', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
        blockQuestions: [{ id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 }],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    expect(screen.queryByRole('button', { name: /^previous$/i })).not.toBeInTheDocument();
  });

  it('sends PREVIOUS when the Previous button is clicked after the first question of the open block', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open', questionIndex: 1 }),
        currentQuestion: { id: 'r1q2', type: 'free_text', prompt: 'Name a vegetable', points: 1 },
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
          { id: 'r1q2', type: 'free_text', prompt: 'Name a vegetable', points: 1 },
        ],
      },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /^previous$/i }));

    expect(sendAction).toHaveBeenCalledWith('PREVIOUS');
  });

  it('hides the Previous button outside of question_open', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break' }),
        currentQuestion: null,
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
          { id: 'r1q2', type: 'free_text', prompt: 'Name a vegetable', points: 1 },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    expect(screen.queryByRole('button', { name: /^previous$/i })).not.toBeInTheDocument();
  });

  it('sends TOGGLE_LEADERBOARD when the Toggle Leaderboard button is clicked', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress(), currentQuestion: null },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /toggle leaderboard/i }));

    expect(sendAction).toHaveBeenCalledWith('TOGGLE_LEADERBOARD');
  });

  it('does not offer a per-question lock control (locking is block-based)', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'question_open' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    expect(screen.queryByRole('button', { name: /lock answers/i })).not.toBeInTheDocument();
  });

  it('marks the teams that have answered the current question in the sidebar', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
        teams: [
          { teamId: 'team-1', teamName: 'The Quizzards' },
          { teamId: 'team-2', teamName: 'Beer Necessities' },
        ],
        answeredTeamIds: ['team-1'],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    expect(screen.getByRole('listitem', { name: /the quizzards has answered/i })).toBeInTheDocument();
    expect(
      screen.getByRole('listitem', { name: /beer necessities has not answered yet/i }),
    ).toBeInTheDocument();
  });

  it('sends FINISH_GRADING when the Finish Grading button is clicked', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'break' }), currentQuestion: null },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /finish grading/i }));

    expect(sendAction).toHaveBeenCalledWith('FINISH_GRADING');
  });

  it('sends END_QUIZ when the End Quiz button is clicked', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'question_open' }), currentQuestion: null },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /end quiz/i }));

    expect(sendAction).toHaveBeenCalledWith('END_QUIZ');
  });

  it('shows live answers for the current question with team name and value', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
      },
      connectionError: null,
      sendAction: vi.fn(),
      liveAnswers: {
        questionId: 'r1q1',
        answers: [
          {
            answerId: 'answer-1',
            teamId: 'team-1',
            teamName: 'The Quizzards',
            value: 'Banana',
            pointsAwarded: null,
          },
        ],
      },
      gradeAnswer: vi.fn(),
    });
    render(<AdminPage />);

    expect(screen.getByText('The Quizzards')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
  });

  it('grades an ungraded answer with the full-points quick button', async () => {
    const gradeAnswer = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break' }),
        currentQuestion: null,
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 2 },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers: vi.fn(),
      liveAnswers: {
        questionId: 'r1q1',
        answers: [
          {
            answerId: 'answer-1',
            teamId: 'team-1',
            teamName: 'The Quizzards',
            value: 'Banana',
            pointsAwarded: null,
          },
        ],
      },
      gradeAnswer,
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /grade the quizzards full points/i }));

    expect(gradeAnswer).toHaveBeenCalledWith('answer-1', 2);
  });

  it('grades an ungraded answer with the half-points quick button', async () => {
    const gradeAnswer = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break' }),
        currentQuestion: null,
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 2 },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers: vi.fn(),
      liveAnswers: {
        questionId: 'r1q1',
        answers: [
          {
            answerId: 'answer-1',
            teamId: 'team-1',
            teamName: 'The Quizzards',
            value: 'Banana',
            pointsAwarded: null,
          },
        ],
      },
      gradeAnswer,
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /grade the quizzards half points/i }));

    expect(gradeAnswer).toHaveBeenCalledWith('answer-1', 1);
  });

  it('shows the awarded grade as a disabled, checked quick button for an already-graded answer', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break' }),
        currentQuestion: null,
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 2 },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers: vi.fn(),
      liveAnswers: {
        questionId: 'r1q1',
        answers: [
          {
            answerId: 'answer-1',
            teamId: 'team-1',
            teamName: 'The Quizzards',
            value: 'Banana',
            pointsAwarded: 2,
          },
        ],
      },
      gradeAnswer: vi.fn(),
    });
    render(<AdminPage />);

    const fullPointsButton = screen.getByRole('button', { name: /grade the quizzards full points/i });
    expect(fullPointsButton).toHaveTextContent('✓ 2');
    expect(fullPointsButton).toBeDisabled();
    expect(screen.getByRole('button', { name: /grade the quizzards 0 points/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /grade the quizzards half points/i })).toBeDisabled();
  });

  it('requests and shows the first block question answers during the grading break', () => {
    const listAnswers = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break', questionIndex: 1 }),
        currentQuestion: null,
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
          { id: 'r1q2', type: 'free_text', prompt: 'Name a planet', points: 1 },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers,
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
    render(<AdminPage />);

    expect(listAnswers).toHaveBeenCalledWith('r1q1');
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('browses to the next block question during the grading break', async () => {
    const listAnswers = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break', questionIndex: 1 }),
        currentQuestion: null,
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
          { id: 'r1q2', type: 'free_text', prompt: 'Name a planet', points: 1 },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers,
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /next question/i }));

    expect(listAnswers).toHaveBeenCalledWith('r1q2');
    expect(screen.getByText('Name a planet')).toBeInTheDocument();
  });

  it('requests the quiz list while the game is in the lobby or ended', () => {
    const requestQuizzes = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'ended' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
      requestQuizzes,
      selectQuiz: vi.fn(),
      quizzes: null,
    });
    render(<AdminPage />);

    expect(requestQuizzes).toHaveBeenCalled();
  });

  it('refreshes the quiz list when the admin returns from ended to lobby', () => {
    const requestQuizzes = vi.fn();
    let status: GameProgress['status'] = 'ended';

    mockUseGameSocket.mockImplementation(() => ({
      snapshot: { progress: progress({ status }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
      requestQuizzes,
      selectQuiz: vi.fn(),
      quizzes: null,
    }));

    const { rerender } = render(<AdminPage />);
    expect(requestQuizzes).toHaveBeenCalledTimes(1);

    status = 'lobby';
    rerender(<AdminPage />);

    expect(requestQuizzes).toHaveBeenCalledTimes(2);
  });

  it('shows quiz selection after the game has ended', () => {
    const selectQuiz = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'ended' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
      requestQuizzes: vi.fn(),
      selectQuiz,
      quizzes: {
        activeQuizId: 'quiz-1',
        quizzes: [
          { id: 'quiz-1', title: 'Spring Quiz' },
          { id: 'quiz-2', title: 'Summer Quiz' },
        ],
      },
    });

    render(<AdminPage />);

    expect(screen.getByRole('heading', { name: /choose new quiz/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select quiz summer quiz/i })).toBeInTheDocument();
  });

  it('lists available quizzes in the lobby with the active quiz marked', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
      requestQuizzes: vi.fn(),
      selectQuiz: vi.fn(),
      quizzes: {
        activeQuizId: 'quiz-1',
        quizzes: [
          { id: 'quiz-1', title: 'Campus Pub Quiz Night' },
          { id: 'quiz-2', title: 'Imported Quiz' },
        ],
      },
    });
    render(<AdminPage />);

    expect(screen.getByText('Campus Pub Quiz Night')).toBeInTheDocument();
    expect(screen.getByText('Imported Quiz')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restart quiz campus pub quiz night/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /select quiz imported quiz/i })).toBeEnabled();
  });

  it('does not call selectQuiz until the quiz choice is confirmed', async () => {
    const selectQuiz = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
      requestQuizzes: vi.fn(),
      selectQuiz,
      quizzes: {
        activeQuizId: 'quiz-1',
        quizzes: [
          { id: 'quiz-1', title: 'Campus Pub Quiz Night' },
          { id: 'quiz-2', title: 'Imported Quiz' },
        ],
      },
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /select quiz imported quiz/i }));

    expect(selectQuiz).not.toHaveBeenCalled();
    expect(screen.getByText(/start "imported quiz"\?/i)).toBeInTheDocument();
  });

  it('marks the clicked quiz as selected while awaiting confirmation', async () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
      requestQuizzes: vi.fn(),
      selectQuiz: vi.fn(),
      quizzes: {
        activeQuizId: 'quiz-1',
        quizzes: [
          { id: 'quiz-1', title: 'Campus Pub Quiz Night' },
          { id: 'quiz-2', title: 'Imported Quiz' },
        ],
      },
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /select quiz imported quiz/i }));

    expect(
      screen.getByRole('button', { name: /imported quiz selected, awaiting confirmation/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('restarts the current quiz once restarting it is confirmed', async () => {
    const selectQuiz = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'ended' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
      requestQuizzes: vi.fn(),
      selectQuiz,
      quizzes: {
        activeQuizId: 'quiz-1',
        quizzes: [
          { id: 'quiz-1', title: 'Campus Pub Quiz Night' },
          { id: 'quiz-2', title: 'Imported Quiz' },
        ],
      },
    });

    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /restart quiz campus pub quiz night/i }));
    await userEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    expect(selectQuiz).toHaveBeenCalledWith('quiz-1');
  });

  it('selects a different quiz once the selection is confirmed', async () => {
    const selectQuiz = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
      requestQuizzes: vi.fn(),
      selectQuiz,
      quizzes: {
        activeQuizId: 'quiz-1',
        quizzes: [
          { id: 'quiz-1', title: 'Campus Pub Quiz Night' },
          { id: 'quiz-2', title: 'Imported Quiz' },
        ],
      },
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /select quiz imported quiz/i }));
    await userEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    expect(selectQuiz).toHaveBeenCalledWith('quiz-2');
  });

  it('clears the pending selection when cancel is clicked', async () => {
    const selectQuiz = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
      requestQuizzes: vi.fn(),
      selectQuiz,
      quizzes: {
        activeQuizId: 'quiz-1',
        quizzes: [
          { id: 'quiz-1', title: 'Campus Pub Quiz Night' },
          { id: 'quiz-2', title: 'Imported Quiz' },
        ],
      },
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /select quiz imported quiz/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByText(/start "imported quiz"\?/i)).not.toBeInTheDocument();
    expect(selectQuiz).not.toHaveBeenCalled();
  });

  it('shows the active quiz name in the left panel', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
      requestQuizzes: vi.fn(),
      selectQuiz: vi.fn(),
      quizzes: {
        activeQuizId: 'quiz-1',
        quizzes: [
          { id: 'quiz-1', title: 'Campus Pub Quiz Night' },
          { id: 'quiz-2', title: 'Imported Quiz' },
        ],
      },
    });
    render(<AdminPage />);

    const sidebar = screen.getByRole('complementary');
    expect(sidebar).toHaveTextContent(/quiz: campus pub quiz night/i);
  });

  it('hides the quiz picker once the game has left the lobby', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
      },
      connectionError: null,
      sendAction: vi.fn(),
      requestQuizzes: vi.fn(),
      selectQuiz: vi.fn(),
      quizzes: {
        activeQuizId: 'quiz-1',
        quizzes: [
          { id: 'quiz-1', title: 'Campus Pub Quiz Night' },
          { id: 'quiz-2', title: 'Imported Quiz' },
        ],
      },
    });
    render(<AdminPage />);

    expect(screen.queryByRole('button', { name: /select quiz/i })).not.toBeInTheDocument();
  });

  it('shows a leaderboard preview from the snapshot', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break' }),
        currentQuestion: null,
        leaderboard: [
          { teamId: 'team-1', teamName: 'The Quizzards', totalPoints: 5 },
          { teamId: 'team-2', teamName: 'Second Place', totalPoints: 3 },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
    render(<AdminPage />);

    expect(screen.getByText('The Quizzards')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Second Place')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
