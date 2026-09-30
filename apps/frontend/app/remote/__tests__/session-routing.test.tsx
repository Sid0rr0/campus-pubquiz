import { screen, waitFor } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameProgress } from '@campus-pubquiz/types';
import type { UseAuthResult } from '@/app/lib/use-auth';
import RemotePage from '@/app/remote/page';

const { mockUseAdminGame, mockUseAuth, searchParamsRef, routerRef } =
  vi.hoisted(() => ({
    mockUseAdminGame: vi.fn(),
    mockUseAuth: vi.fn(),
    searchParamsRef: { current: new URLSearchParams() },
    routerRef: { push: vi.fn(), replace: vi.fn() },
  }));

vi.mock('@/app/lib/use-admin-game', async () => {
  const { adminGameResult } =
    await import('@/app/control/__tests__/test-utils');
  return {
    useAdminGame: (...args: unknown[]) =>
      adminGameResult(mockUseAdminGame(...args)),
  };
});

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => routerRef,
}));

function authenticatedAuthResult(
  overrides: Partial<UseAuthResult> = {},
): UseAuthResult {
  return {
    user: { id: 1, username: 'test-admin', role: 'admin', status: 'active' },
    status: 'authenticated',
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

function progress(overrides: Partial<GameProgress> = {}): GameProgress {
  return {
    status: 'lobby',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
    revealIndex: 0,
    furthestOpenIndex: 0,
    ...overrides,
  };
}

describe('RemotePage — session routing', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams();
    routerRef.push.mockReset();
    routerRef.replace.mockReset();
    mockUseAdminGame.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockUseAdminGame.mockReturnValue({
      snapshot: null,
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
  });

  it('redirects to /login when unauthenticated', async () => {
    mockUseAuth.mockReturnValue(
      authenticatedAuthResult({ status: 'unauthenticated', user: null }),
    );
    renderWithQuery(<RemotePage />);

    await waitFor(() =>
      expect(routerRef.replace).toHaveBeenCalledWith('/login'),
    );
  });

  it('redirects to /sessions when no ?code= is in the URL', async () => {
    renderWithQuery(<RemotePage />);

    await waitFor(() =>
      expect(routerRef.replace).toHaveBeenCalledWith('/sessions'),
    );
  });

  it('redirects to /sessions when the session code is invalid (never got a snapshot)', async () => {
    searchParamsRef.current = new URLSearchParams('code=BADCODE');
    mockUseAdminGame.mockReturnValue({
      snapshot: null,
      connectionError: 'Unknown game session code',
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    await waitFor(() =>
      expect(routerRef.replace).toHaveBeenCalledWith('/sessions'),
    );
  });

  it('does not connect the socket until a session code is known', () => {
    renderWithQuery(<RemotePage />);

    expect(mockUseAdminGame).toHaveBeenLastCalledWith(false, undefined);
  });

  it('connects the socket for the session code once present in the URL', () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    renderWithQuery(<RemotePage />);

    expect(mockUseAdminGame).toHaveBeenLastCalledWith(true, 'ABCDEF');
  });

  it('syncs the URL when the snapshot reports a different session', async () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    mockUseAdminGame.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'lobby' }),
        joinCode: 'GHIJKL',
        quizStructure: { breakRoundNumbers: [] },
        leaderboard: [],
        leaderboardRevealCount: 0,
        activeShowdown: null,
        showdownRevealStep: 0,
      },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    await waitFor(() =>
      expect(routerRef.replace).toHaveBeenCalledWith('/remote?code=GHIJKL'),
    );
  });
  it('stays on the remote when an action is rejected on an otherwise-connected session', async () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    mockUseAdminGame.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break' }),
        joinCode: 'ABCDEF',
        quizStructure: { breakRoundNumbers: [] },
        leaderboard: [],
        leaderboardRevealCount: 0,
        activeShowdown: null,
        showdownRevealStep: 0,
      },
      connectionError: 'Connection lost',
    });
    renderWithQuery(<RemotePage />);

    expect(await screen.findByText('Connection lost')).toBeInTheDocument();
    expect(routerRef.replace).not.toHaveBeenCalledWith('/sessions');
  });

  it('does not sync the URL when the snapshot already matches the session code', () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    mockUseAdminGame.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'lobby' }),
        joinCode: 'ABCDEF',
        quizStructure: { breakRoundNumbers: [] },
        leaderboard: [],
        leaderboardRevealCount: 0,
        activeShowdown: null,
        showdownRevealStep: 0,
      },
      connectionError: null,
    });
    renderWithQuery(<RemotePage />);

    expect(routerRef.replace).not.toHaveBeenCalled();
  });

  it('does not reconnect when the URL moves to the session it is already connected to', () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    mockUseAdminGame.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'lobby' }),
        joinCode: 'GHIJKL',
        quizStructure: { breakRoundNumbers: [] },
        leaderboard: [],
        leaderboardRevealCount: 0,
        activeShowdown: null,
        showdownRevealStep: 0,
      },
      connectionError: null,
    });
    const { rerender } = renderWithQuery(<RemotePage />);

    searchParamsRef.current = new URLSearchParams('code=GHIJKL');
    rerender(<RemotePage />);

    expect(mockUseAdminGame).toHaveBeenLastCalledWith(true, 'ABCDEF');
  });
});
