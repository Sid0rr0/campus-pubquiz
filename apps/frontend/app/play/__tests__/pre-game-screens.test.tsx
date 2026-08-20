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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
        team: {
          teamId: 'team-1',
          teamName: 'The Quizzards',
          teamToken: 'token-1',
        },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByText(/2 rounds of 3 topics/i)).toBeInTheDocument();
    expect(screen.getByText(/no cheating/i)).toBeInTheDocument();
  });

  it('shows the session-specific rules instead of the hardcoded defaults', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'rules' }),
          currentQuestion: null,
          settings: { rules: ['Custom team-phone rule.'] },
        },
        team: {
          teamId: 'team-1',
          teamName: 'The Quizzards',
          teamToken: 'token-1',
        },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByText('Custom team-phone rule.')).toBeInTheDocument();
    expect(screen.queryByText(/no cheating/i)).not.toBeInTheDocument();
  });

  it('shows the round name and a "look at the screen" hint on a fresh round intro card', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'round_intro' }),
          currentQuestion: null,
          roundTitle: 'Picture Round',
        },
        team: {
          teamId: 'team-1',
          teamName: 'The Quizzards',
          teamToken: 'token-1',
        },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByText('Picture Round')).toBeInTheDocument();
    expect(screen.getByText(/look at the screen/i)).toBeInTheDocument();
  });

  it('stays on the block browser, not the round intro card, when Previous re-enters an already-open round', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
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
          progress: progress({ status: 'round_intro', furthestOpenIndex: 0 }),
          currentQuestion: null,
          roundTitle: 'Picture Round',
          blockQuestions: [q1],
        },
        team: {
          teamId: 'team-1',
          teamName: 'The Quizzards',
          teamToken: 'token-1',
        },
      }),
    );
    render(<PlayPage />);

    expect(screen.queryByText('Picture Round')).not.toBeInTheDocument();
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('shows a link to the rules page while waiting in the lobby', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'lobby' }),
          currentQuestion: null,
          joinCode: 'ABCDEF',
        },
        team: {
          teamId: 'team-1',
          teamName: 'The Quizzards',
          teamToken: 'token-1',
        },
      }),
    );
    render(<PlayPage />);

    expect(
      screen.getByRole('link', { name: /read the rules/i }),
    ).toHaveAttribute('href', '/rules?code=ABCDEF');
  });
});
