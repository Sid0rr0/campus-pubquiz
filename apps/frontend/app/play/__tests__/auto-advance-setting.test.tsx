import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { AUTO_ADVANCE_STORAGE_KEY } from '@/app/lib/player-settings-storage';
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

const TEAM = {
  teamId: 'team-1',
  teamName: 'Returning Team',
  teamToken: 'team-token-1',
};

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

describe('PlayPage — auto-advance setting', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseGameSocket.mockReturnValue(socketResult());
  });

  it('keeps showing the current question and offers Prev/Next when auto-advance is off', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem(AUTO_ADVANCE_STORAGE_KEY, '0');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open' }),
          currentQuestion: q1,
          blockQuestions: [q1],
        },
        team: TEAM,
      }),
    );
    const { rerender } = renderWithQuery(<PlayPage />);

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();

    // The admin opens a second question — the team's screen must not move.
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open', questionIndex: 1 }),
          currentQuestion: q2,
          blockQuestions: [q1, q2],
        },
        team: TEAM,
      }),
    );
    rerender(<PlayPage />);

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
    expect(screen.queryByText('Name a planet')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText('Name a planet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prev/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /prev/i }));

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('immediately snaps to the newest question when auto-advance is turned back on', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open', questionIndex: 1 }),
          currentQuestion: q2,
          blockQuestions: [q1, q2],
        },
        team: TEAM,
      }),
    );
    const { rerender } = renderWithQuery(<PlayPage />);
    expect(screen.getByText('Name a planet')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^settings$/i }));
    await userEvent.click(
      screen.getByRole('checkbox', { name: /auto-advance to new question/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: /close/i }));

    // A third question opens while the team is frozen on the second.
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open', questionIndex: 2 }),
          currentQuestion: {
            id: 'r1q3',
            type: 'free_text',
            prompt: 'Name a country',
            points: 1,
            roundNumber: 1,
            questionNumberInRound: 3,
          },
          blockQuestions: [
            q1,
            q2,
            {
              id: 'r1q3',
              type: 'free_text',
              prompt: 'Name a country',
              points: 1,
              roundNumber: 1,
              questionNumberInRound: 3,
            },
          ],
        },
        team: TEAM,
      }),
    );
    rerender(<PlayPage />);
    expect(screen.getByText('Name a planet')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^settings$/i }));
    await userEvent.click(
      screen.getByRole('checkbox', { name: /auto-advance to new question/i }),
    );

    expect(screen.getByText('Name a country')).toBeInTheDocument();
  });
});
