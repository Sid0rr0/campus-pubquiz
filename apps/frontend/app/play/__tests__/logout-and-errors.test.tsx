import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { renderWithQuery } from '@/test-utils/query';
import { progress, socketResult } from './test-utils';

const { mockUseTeamLink, mockFetchPublicSessions, searchParamsRef } =
  vi.hoisted(() => ({
    mockUseTeamLink: vi.fn(),
    mockFetchPublicSessions: vi.fn(),
    searchParamsRef: { current: new URLSearchParams() },
  }));

vi.mock('@/app/lib/use-team-link', () => ({
  useTeamLink: mockUseTeamLink,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/app/lib/sessions-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/lib/sessions-api')>();
  return { ...actual, fetchPublicSessions: mockFetchPublicSessions };
});

describe('PlayPage — logout and errors', () => {
  beforeAll(() => {
    // Radix Select needs these pointer-capture APIs stubbed under jsdom.
    window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    window.HTMLElement.prototype.setPointerCapture = vi.fn();
    window.HTMLElement.prototype.releasePointerCapture = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseTeamLink.mockReturnValue(socketResult());
    mockFetchPublicSessions.mockReset();
    mockFetchPublicSessions.mockResolvedValue([]);
  });

  it('shows the join error directly on the join form, pre-filled, and offers log out, when a returning team reconnect fails', async () => {
    const handleLogOut = vi.fn();
    mockUseTeamLink.mockReturnValue(
      socketResult({
        connectionError: 'Invalid join code',
        nameInput: 'Returning Team',
        hasStoredIdentity: true,
        handleLogOut,
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText(/invalid join code/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /team name/i })).toHaveValue(
      'Returning Team',
    );

    await userEvent.click(screen.getByRole('button', { name: /log out/i }));

    expect(handleLogOut).toHaveBeenCalledTimes(1);
  });

  it('does not offer a "Log out" button when a fresh join fails because the name collides with an existing team', () => {
    const reason =
      'Team name "Taken Name" is already registered — enter its team code to play as this team, or choose a different name';
    mockUseTeamLink.mockReturnValue(
      socketResult({
        connectionError: reason,
        nameInput: 'Taken Name',
        hasStoredIdentity: false,
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText(/already registered/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /log out/i }),
    ).not.toBeInTheDocument();
  });

  it('lets a joined team log out from the game view', async () => {
    const handleLogOut = vi.fn();
    mockUseTeamLink.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open' }),
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
        teamName: 'Returning Team',
        handleLogOut,
      }),
    );
    renderWithQuery(<PlayPage />);

    await userEvent.click(screen.getByRole('button', { name: /change team/i }));

    expect(handleLogOut).toHaveBeenCalledTimes(1);
  });

  it('shows the team code the server issued in the join form after logging out', () => {
    mockUseTeamLink.mockReturnValue(
      socketResult({
        nameInput: 'The Quizzards',
        teamCodeInput: 'QUICK-JADE-FOX',
        hasStoredIdentity: false,
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByRole('textbox', { name: /team code/i })).toHaveValue(
      'QUICK-JADE-FOX',
    );
  });
});
