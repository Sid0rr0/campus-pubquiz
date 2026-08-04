import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { progress, socketResult } from './test-utils';

const { mockUseGameSocket, searchParamsRef } = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
}));

describe('PlayPage — leaderboard overlay', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseGameSocket.mockReturnValue(socketResult());
  });

  it('hides the block question picker during break when the leaderboard overlay is toggled on', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const q1 = {
      id: 'r1q1',
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 1,
    };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'break', isLeaderboardVisible: true }),
          currentQuestion: null,
          blockQuestions: [q1],
        },
        team: { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'team-token-1' },
      }),
    );
    render(<PlayPage />);

    expect(screen.queryByText('Name a fruit')).not.toBeInTheDocument();
    expect(screen.getByText(/leaderboard/i)).toBeInTheDocument();
  });

  it('shows the leaderboard overlay whenever isLeaderboardVisible is true', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: { progress: progress({ isLeaderboardVisible: true }), currentQuestion: null },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByText(/leaderboard/i)).toBeInTheDocument();
  });

  it('still lets a team answer an open question while the leaderboard is toggled on for the big screen', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open', isLeaderboardVisible: true }),
          currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
        },
        team: { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'team-token-1' },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /your answer/i })).toBeInTheDocument();
    expect(screen.queryByText(/leaderboard/i)).not.toBeInTheDocument();
  });

  it('still lets a team answer during the locking countdown while the leaderboard is toggled on', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'locking', isLeaderboardVisible: true }),
          currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
        },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });
});
