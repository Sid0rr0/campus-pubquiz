import { render, screen, within } from '@testing-library/react';
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

function joinAsTeam() {
  window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
}

describe('PlayPage — bonus points panel', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseGameSocket.mockReturnValue(socketResult());
  });

  it('lists every enabled predefined category with its explanation and award count, but never "Custom" as available', () => {
    joinAsTeam();
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'lobby' }),
          currentQuestion: null,
          settings: {
            rules: [],
            enabledBonusCategories: ['shot', 'selfie', 'custom'],
            maxBonusAwardsPerCategory: { shot: 2, selfie: 1 },
          },
        },
        team: {
          teamId: 1,
          teamName: 'The Quizzards',
          teamToken: 'team-token-1',
        },
        myBonusAwards: [{ category: 'shot', points: 1 }],
      }),
    );
    render(<PlayPage />);

    expect(
      screen.getByRole('heading', { name: /bonus points/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Shot')).toBeInTheDocument();
    expect(screen.getByText('Selfie')).toBeInTheDocument();
    expect(
      screen.getByText(/at minimum more than half your player count/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/tag @esn\.cut and @isc_hub\.cz/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 2 times/i)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 1 times/i)).toBeInTheDocument();
    expect(screen.queryByText('Custom')).not.toBeInTheDocument();
  });

  it('shows a received custom award with its points and reason, without a generic "custom available" line', () => {
    joinAsTeam();
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'lobby' }),
          currentQuestion: null,
          settings: {
            rules: [],
            enabledBonusCategories: ['shot', 'selfie', 'custom'],
            maxBonusAwardsPerCategory: {},
          },
        },
        team: {
          teamId: 1,
          teamName: 'The Quizzards',
          teamToken: 'team-token-1',
        },
        myBonusAwards: [
          { category: 'custom', points: 3, reason: 'Best team name' },
        ],
      }),
    );
    render(<PlayPage />);

    expect(screen.getByText('Best team name')).toBeInTheDocument();
    expect(screen.getByText('+3 pt')).toBeInTheDocument();
  });

  it('does not show any custom-award content when the team has not received one', () => {
    joinAsTeam();
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'lobby' }),
          currentQuestion: null,
          settings: {
            rules: [],
            enabledBonusCategories: ['shot', 'selfie', 'custom'],
            maxBonusAwardsPerCategory: {},
          },
        },
        team: {
          teamId: 1,
          teamName: 'The Quizzards',
          teamToken: 'team-token-1',
        },
        myBonusAwards: [],
      }),
    );
    render(<PlayPage />);

    expect(screen.queryByText('Custom')).not.toBeInTheDocument();
    expect(screen.queryByText(/\+\d+ pt$/)).not.toBeInTheDocument();
  });

  it('opens the mobile drawer with the same bonus content when its trigger is clicked', async () => {
    joinAsTeam();
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'lobby' }),
          currentQuestion: null,
          settings: {
            rules: [],
            enabledBonusCategories: ['shot'],
            maxBonusAwardsPerCategory: {},
          },
        },
        team: {
          teamId: 1,
          teamName: 'The Quizzards',
          teamToken: 'team-token-1',
        },
        myBonusAwards: [],
      }),
    );
    render(<PlayPage />);

    await userEvent.click(
      screen.getByRole('button', { name: /bonus points \(0\)/i }),
    );

    const drawer = screen.getByRole('dialog', { name: /bonus points/i });
    expect(within(drawer).getByText('Shot')).toBeInTheDocument();
  });

  it('does not render the bonus panel when no bonus categories are enabled', () => {
    joinAsTeam();
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'lobby' }),
          currentQuestion: null,
          settings: {
            rules: [],
            enabledBonusCategories: [],
            maxBonusAwardsPerCategory: {},
          },
        },
        team: {
          teamId: 1,
          teamName: 'The Quizzards',
          teamToken: 'team-token-1',
        },
      }),
    );
    render(<PlayPage />);

    expect(
      screen.queryByRole('heading', { name: /bonus points/i }),
    ).not.toBeInTheDocument();
  });
});
