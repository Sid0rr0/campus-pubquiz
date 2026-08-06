import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('PlayPage — break and reveal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseGameSocket.mockReturnValue(socketResult());
  });

  it('tells the team answers are locked during the grading break', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'break' }),
          currentQuestion: null,
          blockQuestions: [
            {
              id: 'r1q1',
              type: 'free_text',
              prompt: 'Name a fruit',
              points: 1,
              roundNumber: 1,
              questionNumberInRound: 1,
            },
          ],
        },
        team: { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'team-token-1' },
      }),
    );
    render(<PlayPage />);

    expect(screen.queryByRole('textbox', { name: /your answer/i })).not.toBeInTheDocument();
    expect(screen.getByText(/answers are locked/i)).toBeInTheDocument();
  });

  it('still shows the block question picker during the grading break so teams can browse back', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const q1 = {
      id: 'r1q1',
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 1,
    };
    const q2 = {
      id: 'r1q2',
      type: 'free_text' as const,
      prompt: 'Name a planet',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 2,
    };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'break' }),
          currentQuestion: null,
          blockQuestions: [q1, q2],
        },
        team: { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'team-token-1' },
        myAnswers: { r1q1: 'Banana', r1q2: 'Mars' },
      }),
    );
    render(<PlayPage />);

    // Defaults to the block's last question, with the picker showing both.
    expect(screen.getByText('Name a planet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /question 1 \(answered\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /question 2 \(answered\)/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /question 1 \(answered\)/i }));

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /your answer/i })).not.toBeInTheDocument();
    expect(screen.getByText(/answers are locked/i)).toBeInTheDocument();
  });

  it('still shows the block question picker during reveal', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const q1 = {
      id: 'r1q1',
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 1,
    };
    const q2 = {
      id: 'r1q2',
      type: 'free_text' as const,
      prompt: 'Name a planet',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 2,
    };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'reveal' }),
          currentQuestion: null,
          blockQuestions: [q1, q2],
        },
        team: { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'team-token-1' },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByRole('button', { name: /^question 1$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^question 2$/i })).toBeInTheDocument();
    expect(screen.getByText(/revealing answers/i)).toBeInTheDocument();
  });
});
