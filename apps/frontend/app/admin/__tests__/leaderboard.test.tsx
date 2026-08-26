import { screen, within } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/admin/page';
import {
  authenticatedAuthResult,
  getDesktopButton,
  progress,
} from './test-utils';

const { mockUseGameSocket, mockFetchQuizzes, mockUseAuth, searchParamsRef } =
  vi.hoisted(() => ({
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

describe('AdminPage — leaderboard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams('code=TESTCODE');
    mockUseGameSocket.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
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
    renderWithQuery(<AdminPage />);

    await userEvent.click(
      screen.getByRole('button', { name: /open leaderboard/i }),
    );

    expect(sendAction).toHaveBeenCalledWith('TOGGLE_LEADERBOARD');
  });

  it('shows "Close Leaderboard" and sends TOGGLE_LEADERBOARD when visible', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ isLeaderboardVisible: true }),
        currentQuestion: null,
      },
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(
      screen.getByRole('button', { name: /close leaderboard/i }),
    );

    expect(sendAction).toHaveBeenCalledWith('TOGGLE_LEADERBOARD');
  });

  it('disables Previous while the leaderboard is visible', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({
          status: 'question_open',
          questionIndex: 1,
          isLeaderboardVisible: true,
        }),
        currentQuestion: {
          id: 'r1q2',
          type: 'free_text',
          prompt: 'Name a vegetable',
          points: 1,
        },
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
          {
            id: 'r1q2',
            type: 'free_text',
            prompt: 'Name a vegetable',
            points: 1,
          },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    expect(getDesktopButton(/^previous$/i)).toBeDisabled();
  });

  it('swaps Advance for "Show Next Team" and sends REVEAL_NEXT_TEAM while teams remain hidden', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ isLeaderboardVisible: true }),
        currentQuestion: null,
        leaderboard: [
          {
            teamId: 1,
            teamName: 'The Quizzards',
            totalPoints: 10,
            bonusPoints: 0,
          },
          {
            teamId: 2,
            teamName: 'Beer Necessities',
            totalPoints: 5,
            bonusPoints: 0,
          },
        ],
        leaderboardRevealCount: 0,
      },
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

    expect(
      screen.queryByRole('button', { name: /^advance$/i }),
    ).not.toBeInTheDocument();
    await userEvent.click(getDesktopButton(/show next team/i));

    expect(sendAction).toHaveBeenCalledWith('REVEAL_NEXT_TEAM');
  });

  it('swaps Advance for "Hide Leaderboard" once every team is revealed', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({
          status: 'question_open',
          isLeaderboardVisible: true,
        }),
        currentQuestion: null,
        leaderboard: [
          {
            teamId: 1,
            teamName: 'The Quizzards',
            totalPoints: 10,
            bonusPoints: 0,
          },
        ],
        leaderboardRevealCount: 1,
      },
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

    expect(
      screen.queryByRole('button', { name: /show next team/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^advance$/i }),
    ).not.toBeInTheDocument();

    const hideButton = getDesktopButton(/hide leaderboard/i);
    expect(hideButton).not.toBeDisabled();
    await userEvent.click(hideButton);

    expect(sendAction).toHaveBeenCalledWith('TOGGLE_LEADERBOARD');
  });

  it('re-enables Advance once the leaderboard is closed after a full reveal', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({
          status: 'question_open',
          isLeaderboardVisible: false,
        }),
        currentQuestion: null,
        leaderboard: [
          {
            teamId: 1,
            teamName: 'The Quizzards',
            totalPoints: 10,
            bonusPoints: 0,
          },
        ],
        leaderboardRevealCount: 1,
      },
      connectionError: null,
      sendAction,
    });
    renderWithQuery(<AdminPage />);

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
        teams: [
          { teamId: 'team-1', teamName: 'The Quizzards', isConnected: true },
          { teamId: 'team-2', teamName: 'Second Place', isConnected: true },
        ],
        leaderboard: [
          {
            teamId: 'team-1',
            teamName: 'The Quizzards',
            totalPoints: 5,
            bonusPoints: 0,
            roundPoints: [],
          },
          {
            teamId: 'team-2',
            teamName: 'Second Place',
            totalPoints: 3,
            bonusPoints: 0,
            roundPoints: [],
          },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    const teamsTable = screen.getByRole('table');
    const quizzardsRow = within(teamsTable)
      .getByText('The Quizzards')
      .closest('tr');
    expect(quizzardsRow).not.toBeNull();
    expect(within(quizzardsRow!).getByText('5')).toBeInTheDocument(); // Total column

    const secondPlaceRow = within(teamsTable)
      .getByText('Second Place')
      .closest('tr');
    expect(secondPlaceRow).not.toBeNull();
    expect(within(secondPlaceRow!).getByText('3')).toBeInTheDocument(); // Total column
  });
});
