import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/admin/page';
import { getDesktopButton, progress } from './test-utils';

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

describe('AdminPage — leaderboard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseGameSocket.mockReset();
    mockFetchQuizzes.mockReset();
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
  });

  it('shows "Open Leaderboard" and sends TOGGLE_LEADERBOARD when hidden', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress(), currentQuestion: null },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /open leaderboard/i }));

    expect(sendAction).toHaveBeenCalledWith('TOGGLE_LEADERBOARD');
  });

  it('shows "Close Leaderboard" and sends TOGGLE_LEADERBOARD when visible', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ isLeaderboardVisible: true }), currentQuestion: null },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /close leaderboard/i }));

    expect(sendAction).toHaveBeenCalledWith('TOGGLE_LEADERBOARD');
  });

  it('disables Previous while the leaderboard is visible', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open', questionIndex: 1, isLeaderboardVisible: true }),
        currentQuestion: { id: 'r1q2', type: 'free_text', prompt: 'Name a vegetable', points: 1 },
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
          { id: 'r1q2', type: 'free_text', prompt: 'Name a vegetable', points: 1 },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    expect(getDesktopButton(/^previous$/i)).toBeDisabled();
  });

  it('swaps Advance for "Show Next Team" and sends REVEAL_NEXT_TEAM while teams remain hidden', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ isLeaderboardVisible: true }),
        currentQuestion: null,
        leaderboard: [
          { teamId: 1, teamName: 'The Quizzards', totalPoints: 10, bonusPoints: 0 },
          { teamId: 2, teamName: 'Beer Necessities', totalPoints: 5, bonusPoints: 0 },
        ],
        leaderboardRevealCount: 0,
      },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    expect(screen.queryByRole('button', { name: /^advance$/i })).not.toBeInTheDocument();
    await userEvent.click(getDesktopButton(/show next team/i));

    expect(sendAction).toHaveBeenCalledWith('REVEAL_NEXT_TEAM');
  });

  it('reverts Advance to its normal (but disabled) label once every team is revealed', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open', isLeaderboardVisible: true }),
        currentQuestion: null,
        leaderboard: [{ teamId: 1, teamName: 'The Quizzards', totalPoints: 10, bonusPoints: 0 }],
        leaderboardRevealCount: 1,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    expect(screen.queryByRole('button', { name: /show next team/i })).not.toBeInTheDocument();
    expect(getDesktopButton(/^advance$/i)).toBeDisabled();
  });

  it('re-enables Advance once the leaderboard is closed after a full reveal', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open', isLeaderboardVisible: false }),
        currentQuestion: null,
        leaderboard: [{ teamId: 1, teamName: 'The Quizzards', totalPoints: 10, bonusPoints: 0 }],
        leaderboardRevealCount: 1,
      },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    const advanceButton = getDesktopButton(/^advance$/i);
    expect(advanceButton).not.toBeDisabled();
    await userEvent.click(advanceButton);

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });

  it('shows a leaderboard preview from the snapshot', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break' }),
        currentQuestion: null,
        leaderboard: [
          { teamId: 'team-1', teamName: 'The Quizzards', totalPoints: 5, bonusPoints: 0 },
          { teamId: 'team-2', teamName: 'Second Place', totalPoints: 3, bonusPoints: 0 },
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
