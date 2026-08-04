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

describe('PlayPage — pre-game screens', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseGameSocket.mockReturnValue(socketResult());
  });

  it('shows the rules screen after the lobby, before the first question opens', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'rules' }),
          currentQuestion: null,
          quizStructure: { blockCount: 2, topicsPerBlock: 3 },
        },
        team: { teamId: 'team-1', teamName: 'The Quizzards', teamToken: 'token-1' },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByText(/2 rounds of 3 topics/i)).toBeInTheDocument();
    expect(screen.getByText(/no cheating/i)).toBeInTheDocument();
  });

  it('shows the round name and a "look at the screen" hint on the round intro card', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'round_intro' }),
          currentQuestion: null,
          roundTitle: 'Picture Round',
        },
        team: { teamId: 'team-1', teamName: 'The Quizzards', teamToken: 'token-1' },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByText('Picture Round')).toBeInTheDocument();
    expect(screen.getByText(/look at the screen/i)).toBeInTheDocument();
  });

  it('shows a link to the rules page while waiting in the lobby', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null },
        team: { teamId: 'team-1', teamName: 'The Quizzards', teamToken: 'token-1' },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByRole('link', { name: /read the rules/i })).toHaveAttribute(
      'href',
      '/rules',
    );
  });
});
