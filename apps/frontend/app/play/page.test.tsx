import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameProgress } from '@campus-pubquiz/types';
import PlayPage from '@/app/play/page';

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

describe('PlayPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseGameSocket.mockReturnValue({ snapshot: null, connectionError: null, sendAction: vi.fn() });
  });

  it('shows a join form when no team name is stored', () => {
    render(<PlayPage />);
    expect(screen.getByRole('textbox', { name: /team name/i })).toBeInTheDocument();
  });

  it('stores the team name and switches to the game view after joining', async () => {
    render(<PlayPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /team name/i }), 'The Quizzards');
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    expect(window.localStorage.getItem('campus-pubquiz-team-name')).toBe('The Quizzards');
    expect(screen.getByText(/playing as the quizzards/i)).toBeInTheDocument();
  });

  it('skips the join form when a team name is already stored (reconnect)', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    render(<PlayPage />);

    expect(screen.queryByRole('textbox', { name: /team name/i })).not.toBeInTheDocument();
    expect(screen.getByText(/playing as returning team/i)).toBeInTheDocument();
  });

  it('shows the current question once joined and connected', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<PlayPage />);

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('shows the leaderboard overlay whenever isLeaderboardVisible is true', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ isLeaderboardVisible: true }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<PlayPage />);

    expect(screen.getByText(/leaderboard/i)).toBeInTheDocument();
  });
});
