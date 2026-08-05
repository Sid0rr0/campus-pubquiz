import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/admin/page';
import { authenticatedAuthResult, getDesktopButton, progress } from './test-utils';

const { mockUseGameSocket, mockFetchQuizzes, mockUseAuth } = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  mockFetchQuizzes: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('@/app/lib/quiz-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/quiz-api')>();
  return { ...actual, fetchQuizzes: mockFetchQuizzes };
});

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

describe('AdminPage — navigation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseGameSocket.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockFetchQuizzes.mockReset();
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
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

  it('hides the Previous button on the first question of the first block, during a break', () => {
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

  it('shows the Previous button during a break once the admin has stepped back within the block', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break', roundIndex: 1, revealIndex: 1 }),
        currentQuestion: null,
        blockQuestions: [
          { id: 'r2q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
          { id: 'r2q2', type: 'free_text', prompt: 'Name a vegetable', points: 1 },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    expect(getDesktopButton(/^previous$/i)).toBeInTheDocument();
  });

  it('shows the Previous button on the first question of a break when an earlier block exists', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 'quiz-1',
      quizzes: [
        {
          id: 'quiz-1',
          title: 'Campus Pub Quiz Night',
          rounds: [
            {
              title: 'Round 1',
              breakAfter: true,
              questions: [{ id: 'r1q1', prompt: 'Name a fruit', answer: 'Banana' }],
            },
            {
              title: 'Round 2',
              breakAfter: true,
              questions: [{ id: 'r2q1', prompt: 'Name this song.', answer: 'Yesterday' }],
            },
          ],
        },
      ],
    });
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break', roundIndex: 1, revealIndex: 0 }),
        currentQuestion: null,
        blockQuestions: [{ id: 'r2q1', type: 'free_text', prompt: 'Name this song.', points: 1 }],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    await waitFor(() => expect(getDesktopButton(/^previous$/i)).toBeInTheDocument());
  });

  it('shows the Previous button on the first reveal question, since it can still step back to the round intro card', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'reveal', revealIndex: 0 }),
        currentQuestion: null,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    expect(getDesktopButton(/^previous$/i)).toBeInTheDocument();
  });

  it('hides the Previous button on the first reveal round intro card, with no earlier block to step back to', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'reveal_intro', revealIndex: 0 }),
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

  it('does not offer a per-question lock control (locking is block-based)', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'question_open' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    expect(screen.queryByRole('button', { name: /lock answers/i })).not.toBeInTheDocument();
  });

  it('sends ADVANCE when the Advance button is clicked during a break', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'break' }), currentQuestion: null },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.click(getDesktopButton(/^advance$/i));

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
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
});
