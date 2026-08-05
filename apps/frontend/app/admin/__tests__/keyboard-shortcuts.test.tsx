import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/admin/page';
import { authenticatedAuthResult, progress } from './test-utils';

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

describe('AdminPage — keyboard shortcuts', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseGameSocket.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockFetchQuizzes.mockReset();
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
  });

  it('sends ADVANCE when ArrowRight is pressed', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'question_open' }), currentQuestion: null },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.keyboard('{ArrowRight}');

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });

  it('sends PREVIOUS when ArrowLeft is pressed', async () => {
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

    await userEvent.keyboard('{ArrowLeft}');

    expect(sendAction).toHaveBeenCalledWith('PREVIOUS');
  });

  it('sends TOGGLE_LEADERBOARD when ArrowUp is pressed and the leaderboard is hidden', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress(), currentQuestion: null },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.keyboard('{ArrowUp}');

    expect(sendAction).toHaveBeenCalledWith('TOGGLE_LEADERBOARD');
  });

  it('sends TOGGLE_LEADERBOARD when ArrowDown is pressed and the leaderboard is visible', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ isLeaderboardVisible: true }), currentQuestion: null },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.keyboard('{ArrowDown}');

    expect(sendAction).toHaveBeenCalledWith('TOGGLE_LEADERBOARD');
  });

  it('ignores ArrowUp when the leaderboard is already visible', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ isLeaderboardVisible: true }), currentQuestion: null },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.keyboard('{ArrowUp}');

    expect(sendAction).not.toHaveBeenCalled();
  });

  it('sends REVEAL_NEXT_TEAM on ArrowRight while teams remain hidden on the leaderboard', async () => {
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

    await userEvent.keyboard('{ArrowRight}');

    expect(sendAction).toHaveBeenCalledWith('REVEAL_NEXT_TEAM');
  });

  it('does not trigger a shortcut while typing in a text field', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: null,
      connectionError: null,
      sendAction,
    });
    mockUseAuth.mockReturnValue(
      authenticatedAuthResult({ status: 'unauthenticated', user: null }),
    );
    render(<AdminPage />);

    const passwordField = screen.getByLabelText(/^password$/i);
    passwordField.focus();
    await userEvent.keyboard('{ArrowLeft}{ArrowRight}{ArrowUp}{ArrowDown}');

    expect(sendAction).not.toHaveBeenCalled();
  });
});
