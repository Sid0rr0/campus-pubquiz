import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { progress, socketResult } from './test-utils';

const { mockUseTeamLink, searchParamsRef } = vi.hoisted(() => ({
  mockUseTeamLink: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-team-link', () => ({
  useTeamLink: mockUseTeamLink,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('PlayPage — leaderboard overlay', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseTeamLink.mockReturnValue(socketResult());
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
    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'break', isLeaderboardVisible: true }),
          currentQuestion: null,
          blockQuestions: [q1],
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.queryByText('Name a fruit')).not.toBeInTheDocument();
    expect(screen.getByText(/leaderboard/i)).toBeInTheDocument();
  });

  it('shows the leaderboard overlay whenever isLeaderboardVisible is true', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ isLeaderboardVisible: true }),
          currentQuestion: null,
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText(/leaderboard/i)).toBeInTheDocument();
  });

  it('still lets a team answer an open question while the leaderboard is toggled on for the big screen', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({
            status: 'question_open',
            isLeaderboardVisible: true,
          }),
          currentQuestion: {
            id: 'r1q1',
            type: 'free_text',
            prompt: 'Name a fruit',
            points: 1,
          },
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: /your answer/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/leaderboard/i)).not.toBeInTheDocument();
  });

  it('hides a kahoot question opened behind the leaderboard until the big screen reveals it', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({
            status: 'question_open',
            isLeaderboardVisible: true,
          }),
          isCurrentRoundKahoot: true,
          currentQuestion: {
            id: 'r1q2',
            type: 'free_text',
            prompt: 'Name a vegetable',
            points: 1,
          },
          blockQuestions: [
            {
              id: 'r1q2',
              type: 'free_text',
              prompt: 'Name a vegetable',
              points: 1,
              roundNumber: 1,
              questionNumberInRound: 2,
              roundTitle: 'Round 1',
            },
          ],
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.queryByText('Name a vegetable')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: /your answer/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/leaderboard/i)).toBeInTheDocument();
  });

  it('still lets a team answer during the locking countdown while the leaderboard is toggled on', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'locking', isLeaderboardVisible: true }),
          currentQuestion: {
            id: 'r1q1',
            type: 'free_text',
            prompt: 'Name a fruit',
            points: 1,
          },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('renders without the question while a kahoot question is redacted behind the leaderboard, then shows it once the board is dismissed', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const team = {
      teamId: 'team-1',
      teamName: 'Returning Team',
      teamToken: 'team-token-1',
    };
    const question = {
      id: 'r1q2',
      type: 'free_text' as const,
      prompt: 'Name a planet',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 2,
    };
    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({
            status: 'question_open',
            isLeaderboardVisible: true,
          }),
          isCurrentRoundKahoot: true,
          currentQuestion: null,
          blockQuestions: [],
        },
        team,
      }),
    );
    const { rerender } = renderWithQuery(<PlayPage />);

    expect(screen.queryByText('Name a planet')).not.toBeInTheDocument();

    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({
            status: 'question_open',
            isLeaderboardVisible: false,
          }),
          isCurrentRoundKahoot: true,
          currentQuestion: question,
          blockQuestions: [question],
        },
        team,
      }),
    );
    rerender(<PlayPage />);

    expect(screen.getByText('Name a planet')).toBeInTheDocument();
  });
});
