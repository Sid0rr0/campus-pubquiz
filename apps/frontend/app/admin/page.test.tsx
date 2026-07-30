import { render, screen, within } from '@testing-library/react';
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
    revealIndex: 0,
    ...overrides,
  };
}

// Advance/Previous render in both the always-mounted mobile sticky bar and
// the desktop sidebar (each hidden from the other via a CSS media query that
// jsdom doesn't evaluate) — scope to the desktop <aside> (the "complementary"
// landmark) so these queries match exactly one button.
function getDesktopButton(name: RegExp): HTMLElement {
  return within(screen.getByRole('complementary')).getByRole('button', { name });
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
      listAnswers: vi.fn(),
      liveAnswers: {
        questionId: 'r1q1',
        question: {
          type: 'free_text',
          prompt: 'Name a fruit',
          points: 1,
          correctAnswer: 'Banana',
          roundTitle: 'Round 1',
          roundNumber: 1,
          questionNumberInRound: 1,
          totalQuestionsInRound: 1,
        },
        answers: [],
      },
      gradeAnswer: vi.fn(),
    });
    render(<AdminPage />);
    expect(screen.getByText(/question_open/i)).toBeInTheDocument();
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
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

    await userEvent.click(getDesktopButton(/advance/i));

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });

  it('shows a "Begin Quiz" button that sends ADVANCE while showing the rules screen', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'rules' }), currentQuestion: null },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.click(getDesktopButton(/begin quiz/i));

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });

  it('sends PREVIOUS to step back to the round intro card from the very first question of the quiz', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
        blockQuestions: [{ id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 }],
      },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.click(getDesktopButton(/^previous$/i));

    expect(sendAction).toHaveBeenCalledWith('PREVIOUS');
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
    render(<AdminPage />);

    await userEvent.click(getDesktopButton(/start round/i));

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });

  it('sends PREVIOUS from the round intro card', async () => {
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
    render(<AdminPage />);

    await userEvent.click(getDesktopButton(/^previous$/i));

    expect(sendAction).toHaveBeenCalledWith('PREVIOUS');
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

    await userEvent.click(getDesktopButton(/^previous$/i));

    expect(sendAction).toHaveBeenCalledWith('PREVIOUS');
  });

  it('shows an Advance button that sends ADVANCE during the locking countdown, to skip it early', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'locking' }),
        currentQuestion: { id: 'r2q3', type: 'free_text', prompt: 'Name this song.', points: 3 },
        questionLockAt: Date.now() + 60_000,
      },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.click(getDesktopButton(/^advance$/i));

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });

  it('sends PREVIOUS to step back from the locking countdown to the question', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'locking' }),
        currentQuestion: { id: 'r2q3', type: 'free_text', prompt: 'Name this song.', points: 3 },
        questionLockAt: Date.now() + 60_000,
      },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.click(getDesktopButton(/^previous$/i));

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

  it('hides the Previous button on the first reveal question', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'reveal', revealIndex: 0 }),
        currentQuestion: null,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    expect(screen.queryByRole('button', { name: /^previous$/i })).not.toBeInTheDocument();
  });

  it('sends PREVIOUS from a later reveal question', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'reveal', revealIndex: 1 }),
        currentQuestion: null,
      },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.click(getDesktopButton(/^previous$/i));

    expect(sendAction).toHaveBeenCalledWith('PREVIOUS');
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
    render(<AdminPage />);

    await userEvent.click(getDesktopButton(/^advance$/i));

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
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
        teams: [{ teamId: 'team-1', teamName: 'The Quizzards' }],
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers: vi.fn(),
      liveAnswers: {
        questionId: 'r1q1',
        question: {
          type: 'free_text',
          prompt: 'Name a fruit',
          points: 1,
          correctAnswer: 'Banana',
          roundTitle: 'Round 1',
          roundNumber: 1,
          questionNumberInRound: 1,
          totalQuestionsInRound: 1,
        },
        answers: [
          {
            answerId: 'answer-1',
            teamId: 'team-1',
            teamName: 'The Quizzards',
            value: 'Banana',
            pointsAwarded: 0,
            gradedAt: null,
          },
        ],
      },
      gradeAnswer: vi.fn(),
    });
    render(<AdminPage />);

    expect(screen.getAllByText('The Quizzards').length).toBeGreaterThan(0);
    expect(screen.getByText('Banana')).toBeInTheDocument();
  });

  it('shows every team even if it has not answered yet, and the round, question number and correct answer', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
        teams: [
          { teamId: 'team-1', teamName: 'The Quizzards' },
          { teamId: 'team-2', teamName: 'Beer Necessities' },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers: vi.fn(),
      liveAnswers: {
        questionId: 'r1q1',
        question: {
          type: 'free_text',
          prompt: 'Name a fruit',
          points: 1,
          correctAnswer: 'Banana',
          roundTitle: 'Fruit & Veg',
          roundNumber: 2,
          questionNumberInRound: 3,
          totalQuestionsInRound: 4,
        },
        answers: [
          {
            answerId: 'answer-1',
            teamId: 'team-1',
            teamName: 'The Quizzards',
            value: 'Banana',
            pointsAwarded: 0,
            gradedAt: null,
          },
        ],
      },
      gradeAnswer: vi.fn(),
    });
    render(<AdminPage />);

    expect(screen.getByText(/round 2 \(fruit & veg\)/i)).toHaveTextContent('Q3 of 4');
    expect(screen.getByText(/correct answer: banana/i)).toBeInTheDocument();
    expect(screen.getByText('No answer yet')).toBeInTheDocument();

    const unansweredRow = screen.getByText('No answer yet').closest('li');
    expect(unansweredRow).toHaveClass('opacity-40');
    expect(unansweredRow).toHaveTextContent('Beer Necessities');
    expect(
      screen.getByRole('button', { name: /grade beer necessities full points/i }),
    ).toBeDisabled();
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
        teams: [{ teamId: 'team-1', teamName: 'The Quizzards' }],
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers: vi.fn(),
      liveAnswers: {
        questionId: 'r1q1',
        question: {
          type: 'free_text',
          prompt: 'Name a fruit',
          points: 2,
          correctAnswer: 'Banana',
          roundTitle: 'Round 1',
          roundNumber: 1,
          questionNumberInRound: 1,
          totalQuestionsInRound: 1,
        },
        answers: [
          {
            answerId: 'answer-1',
            teamId: 'team-1',
            teamName: 'The Quizzards',
            value: 'Banana',
            pointsAwarded: 0,
            gradedAt: null,
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
        teams: [{ teamId: 'team-1', teamName: 'The Quizzards' }],
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers: vi.fn(),
      liveAnswers: {
        questionId: 'r1q1',
        question: {
          type: 'free_text',
          prompt: 'Name a fruit',
          points: 2,
          correctAnswer: 'Banana',
          roundTitle: 'Round 1',
          roundNumber: 1,
          questionNumberInRound: 1,
          totalQuestionsInRound: 1,
        },
        answers: [
          {
            answerId: 'answer-1',
            teamId: 'team-1',
            teamName: 'The Quizzards',
            value: 'Banana',
            pointsAwarded: 0,
            gradedAt: null,
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
        teams: [{ teamId: 'team-1', teamName: 'The Quizzards' }],
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers: vi.fn(),
      liveAnswers: {
        questionId: 'r1q1',
        question: {
          type: 'free_text',
          prompt: 'Name a fruit',
          points: 2,
          correctAnswer: 'Banana',
          roundTitle: 'Round 1',
          roundNumber: 1,
          questionNumberInRound: 1,
          totalQuestionsInRound: 1,
        },
        answers: [
          {
            answerId: 'answer-1',
            teamId: 'team-1',
            teamName: 'The Quizzards',
            value: 'Banana',
            pointsAwarded: 2,
            gradedAt: '2026-01-01T00:00:00.000Z',
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

  it('browses to another question via the round number picker', async () => {
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
      quizzes: {
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
                  { id: 'r1q2', prompt: 'Name a planet', answer: 'Mars' },
                ],
              },
            ],
          },
        ],
      },
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /grade question 2 of round 1/i }));

    expect(listAnswers).toHaveBeenCalledWith('r1q2');
    expect(screen.getByText('Name a planet')).toBeInTheDocument();
  });

  it('lets the admin grade any question at any game status, not just during a break', async () => {
    const listAnswers = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers,
      liveAnswers: null,
      gradeAnswer: vi.fn(),
      quizzes: {
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
                  { id: 'r1q2', prompt: 'Name a planet', answer: 'Mars' },
                ],
              },
              {
                title: 'Round 2',
                breakAfter: true,
                questions: [{ id: 'r2q1', prompt: 'Name this song.', answer: 'Yesterday' }],
              },
            ],
          },
        ],
      },
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /grade question 1 of round 2/i }));

    expect(listAnswers).toHaveBeenCalledWith('r2q1');
    expect(screen.getByText('Name this song.')).toBeInTheDocument();
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
          { id: 'quiz-1', title: 'Spring Quiz', rounds: [] },
          { id: 'quiz-2', title: 'Summer Quiz', rounds: [] },
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
          { id: 'quiz-1', title: 'Campus Pub Quiz Night', rounds: [] },
          { id: 'quiz-2', title: 'Imported Quiz', rounds: [] },
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
          { id: 'quiz-1', title: 'Campus Pub Quiz Night', rounds: [] },
          { id: 'quiz-2', title: 'Imported Quiz', rounds: [] },
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
          { id: 'quiz-1', title: 'Campus Pub Quiz Night', rounds: [] },
          { id: 'quiz-2', title: 'Imported Quiz', rounds: [] },
        ],
      },
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /select quiz imported quiz/i }));

    expect(
      screen.getByRole('button', { name: /imported quiz selected, awaiting confirmation/i }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows the rounds and questions for the quiz selected in the picker', async () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
      requestQuizzes: vi.fn(),
      selectQuiz: vi.fn(),
      quizzes: {
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
      },
    });
    render(<AdminPage />);

    expect(screen.queryByText('Name a fruit')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /select quiz imported quiz/i }));

    expect(screen.getByText('Round 1')).toBeInTheDocument();
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('shows a question\'s options and correct answer once its quiz is selected', async () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
      requestQuizzes: vi.fn(),
      selectQuiz: vi.fn(),
      quizzes: {
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
      },
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /select quiz imported quiz/i }));

    expect(screen.getByText(/options: paris, london, berlin/i)).toBeInTheDocument();
    expect(screen.getByText(/answer: paris/i)).toBeInTheDocument();
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
          { id: 'quiz-1', title: 'Campus Pub Quiz Night', rounds: [] },
          { id: 'quiz-2', title: 'Imported Quiz', rounds: [] },
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
          { id: 'quiz-1', title: 'Campus Pub Quiz Night', rounds: [] },
          { id: 'quiz-2', title: 'Imported Quiz', rounds: [] },
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
          { id: 'quiz-1', title: 'Campus Pub Quiz Night', rounds: [] },
          { id: 'quiz-2', title: 'Imported Quiz', rounds: [] },
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
          { id: 'quiz-1', title: 'Campus Pub Quiz Night', rounds: [] },
          { id: 'quiz-2', title: 'Imported Quiz', rounds: [] },
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
          { id: 'quiz-1', title: 'Campus Pub Quiz Night', rounds: [] },
          { id: 'quiz-2', title: 'Imported Quiz', rounds: [] },
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
